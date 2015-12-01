var boom = require('boom')
var braveHapi = require('../brave-hapi')
var bson = require('bson')
var Joi = require('joi')
var underscore = require('underscore')

var v1 = {}

/*
   GET /v1/users/{userId}
 */

v1.get =
{ handler: function (runtime) {
  return async function (request, reply) {
    var result, user
    var userId = request.params.userId
    var users = runtime.db.get('users')

    user = await users.findOne({ userId: userId })
    if (!user) { return reply(boom.notFound('user entry does not exist: ' + userId)) }
    // NB: temporary
    if (!user.timestamp) {
      user = await users.update({ userId: userId }, { $currentDate: { timestamp: { $type: 'timestamp' } } }, { upsert: true })
    }
    result = underscore.extend(underscore.omit(user, '_id', 'wallet'), { timestamp: user.timestamp.toString() })

    reply(result)
  }
},

  description: 'Returns user entry information',
  notes: 'The most common use is to retrieve cryptographic information stored during the creation of a user entry.<p></p>Applications use an advisory locking cheme in order to synchronize and persist shared information. This operation retrieves information shared between all applications for the corresponding user entry. These properties are present in the user entry:<ul><li><strong>userId:</strong> identifier for the user entry</li><li><strong>timestamp:</strong> monotonically-increasing value for coordinating multiple clients updating the same user entry</li><li><strong>envelope.version:</strong> always 1 (at least for now!)</li><li><strong>envelope.privateKey:</strong> ...</li><li><strong>envelope.iv:</strong> ...</li><li><strong>envelope.publicKey:</strong> ...</li></ul>',
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
 */

v1.put =
{ handler: function (runtime) {
  return async function (request, reply) {
    if (!request.payload) request.payload = {}

    var count, createP, result, update, user, wallet
    var debug = braveHapi.debug(module, request)
    var envelope = request.payload.envelope
    var userId = request.params.userId
    var timestamp = request.payload.timestamp
    var appStates = runtime.db.get('app_states')
    var users = runtime.db.get('users')

    if (envelope) {
      if (envelope.version !== 1) {
        return reply(boom.badRequest('invalid or missing envelope.version: ' + JSON.stringify(envelope.version)))
      }
      if ((!envelope.privateKey) || (typeof envelope.publicKey !== 'string') || (envelope.publicKey.length <= 96)) {
        return reply(boom.badRequest('invalid or missing envelope.privateKey: ' + JSON.stringify(envelope.privateKey)))
      }
/* expecting

var to_hex = function (bs) {
    var encoded = []

    for (var i = 0; i < bs.length; i++) {
        encoded.push("0123456789abcdef"[(bs[i] >> 4) & 15])
        encoded.push("0123456789abcdef"[bs[i] & 15])
    }
    return encoded.join('')
}

var ab2b = function(ab) {
    var buffer = []

    var view = new Uint8Array(ab)
    for (var i = 0; i < ab.byteLength; ++i) buffer[i] = view[i]

    return buffer
}

    crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, false, [ 'sign' ]).then(k => {
        crypto.subtle.exportKey('raw', k.publicKey).then(p =>
            console.log(to_hex(ab2b(publicKey)));
        )
    })

 */
      if ((!envelope.publicKey) || (typeof envelope.publicKey !== 'string') || (envelope.publicKey.length !== 130)) {
        return reply(boom.badRequest('invalid or missing envelope.publicKey: ' + JSON.stringify(envelope.publicKey)))
      }
    }
    /* not going to argue with Joi about the payload... */
    if (request.payload.userId) return reply(boom.badRequest('"userId" is not allowed'))
    if (request.payload.wallet) return reply(boom.badRequest('"wallet" is not allowed'))

    try {
      update = { $currentDate: { timestamp: { $type: 'timestamp' } },
                 $setOnInsert: { statAdReplaceCount: 0 },
                 $set: {},
                 $unset: {} }
      underscore.keys(request.payload).forEach(function (key) {
        var value = request.payload[key]

        if (key === 'timestamp') return
        update[(key === 'envelope') ? '$setOnInsert' : (value !== null) ? '$set' : '$unset'][key] = value
      })
      if (underscore.keys(update.$set).length === 0) delete update.$set
      if (underscore.keys(update.$unset).length === 0) delete update.$unset

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

  description: 'Creates or updates a user entry with the vault',
  notes: 'Once a user entry is successfully registered, the browser generates (as often as it wishes) a "sessionId" parameter for subsequent operations, in order to identify both the user entry and session.  The "envelope" parameter is valid only if the user entry is created; otherwise, it is ignored.<p></p>This operation updates information shared between all applications for the correpsonding user entry. To successfully update the shared information, the browser must:<ol><li>1. Use the "GET /v1/users/{userId}" operation to retrieve the current information; then,</li><li>2. Modify the returned "payload" as appropriate; then,</li><li>3. Use the "PUT /v1/users/{userId}" operation with the previously-returned "timestamp" and the modified "payload".</li><li>4. If a "422" is returned, go back to Step 1; otherwise,</li><li>5. Optionally: locally persist the newly-returned "timestamp" and the modified "payload", so as to skip Step 1 the next time a state update is desired.</li></ol>This allows multiple applications to (patiently) coordinate their actions in upgrading the shared information. However, if an application must universally overwrite the shared information, it omits the "timestamp" parameter.',
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
        boomlet: Joi.string().required().description('invalid or missing envelope.version')
      }),
      400: Joi.object({
        boomlet: Joi.string().required().description('invalid or missing envelope.privateKey')
      }),
      400: Joi.object({
        boomlet: Joi.string().required().description('invalid or missing envelope.publicKey')
      }),
      400: Joi.object({
        boomlet: Joi.string().required().description('userId is not allowed')
      }),
      400: Joi.object({
        boomlet: Joi.string().required().description('wallet is not allowed')
      })
    }
 */
  }
}

module.exports.routes =
[ braveHapi.routes.async().get().path('/v1/users/{userId}').config(v1.get),
  braveHapi.routes.async().put().path('/v1/users/{userId}').config(v1.put)
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
}
