var boom = require('boom')
var braveHapi = require('../brave-hapi')
var bson = require('bson')
var helper = require('./helper')
var Joi = require('joi')

var v0 = {}

/*
   POST /auth
        { "userId": "..." }
        create (entry MUST not exist)
 */

v0.post =
{ handler: function (runtime) {
  return async function (request, reply) {
    var walletResult
    var debug = braveHapi.debug(module, request)
    var user = request.payload
    var users = runtime.db.get('users')

    try {
      walletResult = await runtime.wallet.generate(user)

      user.wallet =
      { id: walletResult.wallet.id(),
        label: walletResult.wallet.label(),
        userKeychainEncryptedXprv: walletResult.userKeychain.encryptedXprv,
        backupKeychainEncryptedXprv: walletResult.backupKeychain.encryptedXprv
      }
    } catch (ex) {
      debug('wallet error', ex)
      // return reply(boom.badImplementation('wallet creation failed', ex));
    }

    try {
      await users.insert(user)
    } catch (ex) {
      debug('insert error', ex)
      return reply(boom.badData('user entry already exists', { userId: user.userId }))
    }

    debug('user=', user)
    reply('OK!')
  }
},

validate:
  { payload:
    { userId: Joi.string().guid().required() }
  }
}

var v1 = {}

/*
   PUT /v1/users/{userId}
       create (entry MUST not exist)
 */

v1.put =
{ handler: function (runtime) {
  return async function (request, reply) {
    var walletResult
    var debug = braveHapi.debug(module, request)
    var userId = request.params.userId
    var user = { userId: userId, statAdReplaceCount: 0 }
    var appStates = runtime.db.get('app_states')
    var users = runtime.db.get('users')

    try {
      walletResult = await runtime.wallet.generate(user)

      user.wallet =
      { id: walletResult.wallet.id(),
        label: walletResult.wallet.label(),
        userKeychainEncryptedXprv: walletResult.userKeychain.encryptedXprv,
        backupKeychainEncryptedXprv: walletResult.backupKeychain.encryptedXprv
      }
    } catch (ex) {
      debug('wallet error', ex)
      // return reply(boom.badImplementation('wallet creation failed', ex));
    }

    try {
      await users.insert(user)
    } catch (ex) {
      debug('insert error', ex)
      return reply(boom.badData('user entry already exists', { userId: userId }))
    }

    reply().created()

    try {
      await appStates.insert({ userId: userId, timestamp: bson.Timestamp.ZERO, payload: {} })
    } catch (ex) {
      debug('insert error', ex)
    }
  }
},

validate:
  { params:
    { userId: Joi.string().guid().required() }
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

    count = await sessions.update({ sessionId: sessionId, userId: userId },
                                  { $currentDate: { timestamp: { $type: 'timestamp' } },
                                    $set: { activity: 'delete' }
                                  },
                                  { upsert: false })
    if (typeof count === 'object') { count = count.nMatched }
    if (count === 0) { return reply(boom.notFound('', { sessionId: sessionId, userId: userId })) }

    result = await helper.sessionId2stats(runtime, userId, sessionId)
    reply(result || {})
  }
},

validate:
  { params:
    { userId: Joi.string().guid().required(),
      sessionId: Joi.string().guid().required()
    }
  }
}

module.exports.routes =
[ braveHapi.routes.async().post().path('/auth').config(v0.post),
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
      others: [ { userId: 1 }, { timestamp: 1 } ]
    }
  ])
}
