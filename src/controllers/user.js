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
    var result
    var userId = request.params.userId
    var users = runtime.db.get('users')

    result = await users.findOne({ userId: userId })
    if (!result) { return reply(boom.notFound('user entry does not exist: ' + userId)) }
    result = underscore.omit(result, '_id', 'wallet')

    reply(result)
  }
},

  description: 'Return user entry information',
  notes: 'The most common use is to retrieve cryptographic information stored during the creation of a user entry.',
  tags: ['api'],

  validate:
    { params:
      { userId: Joi.string().guid().required().description('the identity of the user entry') }
    },

  response: {
    schema: Joi.any()
  }
}

/*
   PUT /v1/users/{userId}
        create/update (entry MAY already exist)
 */

v1.put =
{ handler: function (runtime) {
  return async function (request, reply) {
    var count, createP, result, update, user, wallet
    var debug = braveHapi.debug(module, request)
    var envelope = request.payload.envelope
    var userId = request.params.userId
    var appStates = runtime.db.get('app_states')
    var users = runtime.db.get('users')

    if (envelope) {
      if (envelope.version !== 1) return reply(boom.badRequest('invalid envelope.version: ' + envelope.version))
      if ((!envelope.privateKey) || (underscore.keys(envelope.privateKey).length === 0)) {
        return reply(boom.badRequest('invalid or missing envelope.privateKey: ' + JSON.stringify(envelope.privateKey)))
      }
      if ((!envelope.publicKey) || (typeof envelope.publicKey !== 'string') || (envelope.publicKey.length !== 130)) {
        return reply(boom.badRequest('invalid or missing envelope.publicKey: ' + JSON.stringify(envelope.publicKey)))
      }
    }

    try {
      update = { $setOnInsert: { statAdReplaceCount: 0 }, $set: {}, $unset: {} }
      underscore.keys(request.payload).forEach(function (key) {
        var value = request.payload[key]

        update[(key === 'envelope') ? '$setOnInsert' : (value !== null) ? '$set' : '$unset'][key] = value
      })
      if (underscore.keys(update.$set).length === 0) delete update.$set
      if (underscore.keys(update.$unset).length === 0) delete update.$unset

      await users.update({ userId: userId }, update, { upsert: true })
    } catch (ex) {
      debug('update error', ex)
      return reply(boom.badImplementation('update failed: ' + userId, ex))
    }

    user = await users.findOne({ userId: userId })
    if (!user) { return reply(boom.badImplementation('insert failed: ' + userId)) }

    createP = !user.wallet
    if (createP) {
/*
      try {
        wallet = await runtime.wallet.generate(user)

        user.wallet =
        { id: wallet.wallet.id(),
          label: wallet.wallet.label(),
          userKeychainEncryptedXprv: wallet.userKeychain.encryptedXprv,
          backupKeychainEncryptedXprv: wallet.backupKeychain.encryptedXprv
        }
      } catch (ex) {
        debug('wallet error', ex)
//      return reply(boom.badImplementation('wallet creation failed', ex))
        wallet = {}
        user.wallet = {}
      }
 */
      wallet = {}
      user.wallet = {}

      count = await users.update({ userId: userId }, { $set: { wallet: user.wallet } }, { upsert: true })
      if (typeof count === 'object') { count = count.nMatched }
      if (count === 0) { return reply(boom.badImplementation('update failed: ' + userId)) }
    }

    result = underscore.omit(user, '_id', 'wallet')
    if (!wallet) return reply(result)
    reply(result).created()

    try {
      await appStates.insert({ userId: userId, timestamp: bson.Timestamp(), payload: {} })
    } catch (ex) {
      debug('insert error', ex)
    }
  }
},

  description: 'Registers a user with the vault',
  notes: 'Once a user is successfully registered, the browser generates (as often as it wishes) a "sessionId" parameter for subsequent operations, in order to identify both the user and browser session.',
  tags: ['api'],

  validate:
    { params:
      { userId: Joi.string().guid().required().description('the identity of the user entry') }
    },

  response: {
    schema: Joi.any().empty()
/*
    status: {
      201: Joi.any().empty()
    }
 */
  }
}

/*
   DELETE  /v1/users/{userId}/sessions/{sessionId}
 */

v1.delete =
{ handler: function (runtime) {
  return async function (request, reply) {
    var count, result
    var userId = request.params.userId
    var sessionId = request.params.sessionId
    var sessions = runtime.db.get('sessions')

    count = await sessions.update({ sessionId: sessionId },
                                  { $currentDate: { timestamp: { $type: 'timestamp' } },
                                    $set: { activity: 'delete' }
                                  },
                                  { upsert: true })
    if (typeof count === 'object') { count = count.nMatched }
    if (count === 0) {
      return reply(boom.notFound('session entry does not exist: ' + sessionId + ' for user entry: ' + userId))
    }

    result = await helper.sessionId2stats(runtime, userId, sessionId)
    reply(result || {})
  }
},

  description: 'Marks a session as no longer active',
  notes: 'The corresponding session entry is considered "no longer valid". If a sessionId is not referenced in a timely-fashion, the vault may choose to invalidate it. Regardless, the sessionId may no longer be used to perform new operations.',
  tags: ['api'],

  validate:
    { params:
      { userId: Joi.string().guid().required().description('the identity of the user entry'),
        sessionId: Joi.string().guid().required().description('the identity of the session')
      }
    },

  response: {
    schema: Joi.object().keys({
      replacements: Joi.number().min(0).optional().description('the number of ad replacements for this session')
    })
  }
}

module.exports.routes =
[ braveHapi.routes.async().get().path('/v1/users/{userId}').config(v1.get),
  braveHapi.routes.async().put().path('/v1/users/{userId}').config(v1.put),
  braveHapi.routes.async().delete().path('/v1/users/{userId}/sessions/{sessionId}').config(v1.delete)
]

module.exports.initialize = async function (debug, runtime) {
  runtime.db.checkIndices(debug,
  [ { category: runtime.db.get('users'),
      name: 'users',
      property: 'userId',
      empty: { userId: '', intents: [] },
      unique: [ { userId: 1 } ]
    },
    { category: runtime.db.get('sessions'),
      name: 'sessions',
      property: 'sessionId',
      empty: { userId: '', sessionId: '', timestamp: bson.Timestamp.ZERO, intents: [] },
      unique: [ { sessionId: 1 } ],
      others: [ { userId: 0 }, { timestamp: 1 } ]
    }
  ])
}
