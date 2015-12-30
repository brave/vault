var boom = require('boom')
var braveHapi = require('../brave-hapi')
var bson = require('bson')
var helper = require('./helper')
var Joi = require('joi')
var underscore = require('underscore')

var v1 = {}

/*
   GET /v1/users/{userId}
 */

v1.get =
{ handler: function (runtime) {
  return async function (request, reply) {
    var result, user, wallet
    var debug = braveHapi.debug(module, request)
    var userId = request.params.userId.toUpperCase()
    var users = runtime.db.get('users')

    user = await users.findOne({ userId: userId })
    if (!user) { return reply(boom.notFound('user entry does not exist: ' + userId)) }
    // NB: temporary
    if (!user.timestamp) {
      user = await users.update({ userId: userId }, { $currentDate: { timestamp: { $type: 'timestamp' } } }, { upsert: true })
      user = await users.findOne({ userId: userId })
    }
    if (user.wallets) {
      for (wallet of user.wallets) {
        try {
          wallet.balance = await runtime.wallet.balance(wallet.id)
        } catch (ex) {
          debug('wallet error', ex)
        }
      }
    }

    result = underscore.extend(underscore.omit(user, '_id', 'keychains'), { timestamp: user.timestamp.toString() })

    reply(helper.add_nonce_data(result))
  }
},

  description: 'Returns user entry information',
  notes: 'Consult <a href="https://github.com/brave/vault/wiki/Principles#globalstate">Global State Principles</a>.',
  tags: ['api'],

  validate:
    { params: { userId: Joi.string().guid().required().description('the identity of the user entry') }
    },

  response: {
    schema: Joi.any()

/*
    status: {
      404: Joi.object({
        boomlet: Joi.string().required().description('user entry does not exist')
      })
    }
 */
  }
}

/*
   PUT /v1/users/{userId}
        create/update (entry MAY already exist)

   i'd rather this be a POST for creation and a PUT for update, instead of a PUT for upsert
   however, using a POST implies that the server generates the userId, which is contrary to "the model"
 */

v1.put =
{ handler: function (runtime) {
  return async function (request, reply) {
    if (!request.payload) request.payload = {}

    var count, createP, result, update, user, wallet
    var debug = braveHapi.debug(module, request)
    var userId = request.params.userId.toUpperCase()
    var timestamp = request.payload.timestamp
    var payload = request.payload.payload || {}
    var users = runtime.db.get('users')

    user = await users.findOne({ userId: userId })
    createP = !user
    if (createP) {
      // NB: payload.version should be mandatory
      if ((payload.version) && (payload.version !== 1)) {
        return reply(boom.badRequest('invalid or missing payload.version: ' + JSON.stringify(payload.version)))
      }
      // NB: payload.publicKey should be mandatory
      if ((payload.version) &&
             ((!payload.publicKey) || (typeof payload.publicKey !== 'string') || (payload.publicKey.length !== 130))) {
        return reply(boom.badRequest('invalid or missing payload.publicKey: ' + JSON.stringify(payload.publicKey)))
      }
    }

    if (user || payload.version) {
      result = await helper.verify(debug, user || { userId: userId, version: payload.version, publicKey: payload.publicKey },
                                   request.payload)
      if (result) return reply(result)
    }

    try {
      delete request.payload.timestamp
      update = { $currentDate: { timestamp: { $type: 'timestamp' } },
                 $setOnInsert: { replacements: 0 },
                 $set: { state: request.payload }
               }

      if ((!user) && (payload.version)) {
        update.$setOnInsert.version = payload.version
        update.$setOnInsert.publicKey = payload.publicKey
      }

      if (timestamp) {
        try { timestamp = bson.Timestamp.fromString(timestamp) } catch (ex) {
          return reply(boom.badRequest('invalid timestamp: ' + timestamp))
        }

        try {
          count = await users.update({ userId: userId, timestamp: timestamp }, update, { upsert: true })
        } catch (ex) {
          return reply(boom.badData('timestamp mismatch: ' + timestamp))
        }
        if (typeof count === 'object') { count = count.nMatched }
        if (count === 0) { return reply(boom.badData('timestamp mismatch: ' + timestamp)) }
      } else {
        await users.update({ userId: userId }, update, { upsert: true })
      }
    } catch (ex) {
      debug('update failed for users', ex)
      return reply(boom.badImplementation('update failed: ' + userId, ex))
    }

    user = await users.findOne({ userId: userId })
    if (!user) { return reply(boom.badImplementation('upsert failed: ' + userId)) }

    if ((!user.wallets) && (payload.xpub)) {
      try {
        result = await runtime.wallet.generate(user, payload.xpub)
        wallet = result.wallet.wallet
        user.wallets = [ { id: wallet.id, type: 'primary', currency: 'btc' } ]
        user.keychains = [ underscore.extend({ id: wallet.id }, underscore.omit(result, 'wallet', 'warning')) ]
      } catch (ex) {
        debug('wallet error', ex)
        return reply(boom.badImplementation('wallet creation failed', ex))
      }

      count = await users.update({ userId: userId }, { $set: { wallets: user.wallets, keychains: user.keychains } },
                                 { upsert: true })
      if (typeof count === 'object') { count = count.nMatched }
      if (count === 0) { return reply(boom.badImplementation('update failed: ' + userId)) }
    }

    result = underscore.extend(underscore.omit(user, '_id', 'keychains'), { timestamp: user.timestamp.toString() })
    reply(helper.add_nonce_data(result)).code(createP ? 201 : 200)
  }
},

  description: 'Creates or updates a user entry',
  notes: 'Consult <a href="https://github.com/brave/vault/wiki/Principles#globalstate">Global State Principles</a>.',
  tags: ['api'],

  validate:
    { params: { userId: Joi.string().guid().required().description('the identity of the user entry') }
    },

  response: {
    schema: Joi.any()
/*
    status: {
      200: Joi.any(),
      201: Joi.any(),
      400: Joi.object({
        boomlet: Joi.string().required().description('invalid or missing payload.version')
      }),
      400: Joi.object({
        boomlet: Joi.string().required().description('invalid or missing payload.publicKey')
      }),
      400: Joi.object({
        boomlet: Joi.string().required().description('invalid timestamp')
      }),
      422: Joi.object({
        boomlet: Joi.string().required().description('timestamp mismatch')
      }),
      500: Joi.object({
        boomlet: Joi.string().required().description('update failed')
      }),
      500: Joi.object({
        boomlet: Joi.string().required().description('upsert failed')
      }),
      400: Joi.object({
        boomlet: Joi.string().required().description('header.nonce is invalid')
      }),
      422: Joi.object({
        boomlet: Joi.string().required().description('header.nonce is untimely')
      }),
      422: Joi.object({
        boomlet: Joi.string().required().description('signature error')
      })
    }
 */
  }
}

/*
   DELETE /v1/users/{userId}
 */

v1.delete =
{ handler: function (runtime) {
  return async function (request, reply) {
    if (!request.query) request.query = {}

    var result, user
    var debug = braveHapi.debug(module, request)
    var userId = request.params.userId.toUpperCase()
    var sessions = runtime.db.get('sessions')
    var users = runtime.db.get('users')

    user = await users.findOne({ userId: userId })
    if (!user) { return reply(boom.notFound('user entry does not exist: ' + userId)) }

    result = await helper.verify(debug, user, request.query.message)
    if (result) return reply(result)

    result = await users.remove({ userId: userId })

    reply().code(204)

    try { sessions.remove({ userId: userId }) } catch (ex) { debug('remove failed for sessions', ex) }
  }
},

  description: 'Delete a user entry, along with any associated data',
  notes: 'For the purpose authentication the "message" parameter just be present and contain a JSON-encoded header/payload pairing, with any JSON value for the  payload.',
  tags: ['api'],

  validate:
    { params: { userId: Joi.string().guid().required().description('the identity of the user entry') },
      query: { message: helper.add_header_schema(Joi.any()).required() }
    },

  response: {
/*
    status: {
      404: Joi.object({
        boomlet: Joi.string().required().description('user entry does not exist')
      })
    }
 */
  }
}

module.exports.routes =
[ braveHapi.routes.async().get().path('/v1/users/{userId}').config(v1.get),
  braveHapi.routes.async().put().path('/v1/users/{userId}').config(v1.put),
  braveHapi.routes.async().delete().path('/v1/users/{userId}').config(v1.delete)
]

module.exports.initialize = async function (debug, runtime) {
  runtime.db.checkIndices(debug,
  [ { category: runtime.db.get('users'),
      name: 'users',
      property: 'userId',
      empty: { userId: '', timestamp: bson.Timestamp.ZERO },
      unique: [ { userId: 1 } ],
      others: [ { timestamp: 1 } ]
    }
  ])

// temporary
  'intents,ad_units,replacements'.split(',').forEach(collection => {
    try {
      runtime.db.get(collection).drop()
    } catch (ex) {
      debug('unable to reset ' + collection + ' collection: ' + ex.toString())
    }
  })
}
