var boom = require('boom')
var braveHapi = require('../brave-hapi')
var bson = require('bson')
var helper = require('./helper')
var Joi = require('joi')
var underscore = require('underscore')

var v1 = {}

/*
   PUT /v1/users/{userId}
 */

v1.put =
{ handler: function (runtime) {
  return async function (request, reply) {
    var count, update, user, wallet
    var debug = braveHapi.debug(module, request)
    var userId = request.params.userId
    var appStates = runtime.db.get('app_states')
    var users = runtime.db.get('users')

    try {
      update = { $setOnInsert: { statAdReplaceCount: 0 } }
      if (underscore.keys(request.payload).length > 0) underscore.extend(update, request.payload)

      await users.update({ userId: userId }, update, { upsert: true })
    } catch (ex) {
      debug('update error', ex)
      return reply(boom.badImplementation('update failed', ex))
    }

    user = await users.findOne({ userId: userId })
    if (!user) { return reply(boom.badImplementation('insert failed')) }

    if (!user.wallet) {
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
      if (count === 0) { return reply(boom.badImplementation('update failed', { userId: userId })) }
    }

    if (!wallet) return reply().code(204)
    reply().created()

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
    if (count === 0) { return reply(boom.notFound('', { sessionId: sessionId, userId: userId })) }

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
[ braveHapi.routes.async().put().path('/v1/users/{userId}').config(v1.put),
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
