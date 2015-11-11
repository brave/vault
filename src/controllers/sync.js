var boom = require('boom')
var braveHapi = require('../brave-hapi')
var bson = require('bson')
var Joi = require('joi')
var underscore = require('underscore')

var v1 = {}

/*
   GET /v1/users/{userId}/appState
 */

v1.get =
{ handler: function (runtime) {
  return async function (request, reply) {
    var result
    var userId = request.params.userId
    var appStates = runtime.db.get('app_states')

    result = await appStates.findOne({ userId: userId })
    if (!result) { return reply(boom.notFound('', { userId: userId })) }

    underscore.extend(result, { timestamp: result.timestamp.toString() })
    reply(underscore.omit(result, '_id', 'userId'))
  }
},

  description: 'Returns shared application-state',
  notes: 'Applications use an advisory locking cheme in order to synchronize and persist shared information. This operation retrieves information shared between all applications for the corresponding user. The "payload" object is opaque to the vault &mdash; the applications are responsible for determining the syntax and semantics of the information. If no information has been previously stored for the correpsonding "userId", the empty object ("{}") is returned.',
  tags: ['api'],

  validate:
    { params:
      { userId: Joi.string().guid().required().description('the identity of the user entry') }
    },

  response: {
    schema: Joi.object({
      timestamp: Joi.string().hostname().required().description('an opaque, monotonically-increasing value'),
      payload: Joi.any().required().description('any arbitrary JSON value, including the empty object')
    })
/*
    status: {
      404: Joi.object({
        boomlet: Joi.string().required().description('userId does not exist')
      })
    }
 */
  }
}

/*
   PUT /v1/users/{userId}/appState
        { "timestamp": "...", "payload": {} }
 */

v1.put =
{ handler: function (runtime) {
  return async function (request, reply) {
    var count, result, state
    var userId = request.params.userId
    var timestamp = request.payload.timestamp
    var appStates = runtime.db.get('app_states')

    state = { $currentDate: { timestamp: { $type: 'timestamp' } },
              $set: { userId: userId,
                      payload: request.payload.payload
                    }
            }
    if (timestamp) {
      try { timestamp = bson.Timestamp.fromString(timestamp) } catch (ex) {
        return reply(boom.badRequest('invalid timestamp', { timestamp: timestamp }))
      }

      count = await appStates.update({ userId: userId, timestamp: timestamp }, state, { upsert: false })
      if (typeof count === 'object') { count = count.nMatched }
      if (count === 0) { return reply(boom.badData('timestamp mismatch', { timestamp: timestamp })) }
    } else {
      await appStates.update({ userId: userId }, state, { upsert: true })
    }

    result = await appStates.findOne({ userId: userId }, { timestamp: true })
    underscore.extend(result, { timestamp: result.timestamp.toString() })
    reply(underscore.omit(result, '_id', 'userId'))
  }
},

  description: 'Records shared application-state',
  notes: 'This operation updates information shared between all applications for the correpsonding user. To successfully update the shared information, the browser must:<ol><li>1. Use the "GET /v1/users/{userId}/appState" operation to retrieve the current information; then,</li><li>2. Modify the returned "payload" as appropriate; then,</li><li>3. Use the "PUT /v1/users/{userId}/appState" operation with the previously-returned "timestamp" and the modified "payload".</li><li>4. If a "422" is returned, go back to Step 1; otherwise,</li><li>5. Optionally: persist locally the newly-returned "timestamp" and the modified "payload", so as to skip Step 1 the next time a state update is desired.</li></ol>This allows multiple applications to (patiently) coordinate their actions in upgrading the shared information. However, if an application must universally overwritte the shared information, it omits the "timestamp" parameter.',
  tags: ['api'],

  validate:
    { params:
      { userId: Joi.string().guid().required().description('the identity of the user entry') },
      payload:
      { timestamp: Joi.string().regex(/^[0-9]+$/).min(19).optional().description('an opaque, monotonically-increasing value'),
        payload: Joi.any().required().description('any arbitrary JSON value, including the empty object')
      }
    },

  response: {
    schema: Joi.object({
      timestamp: Joi.string().hostname().required().description('an opaque, monotonically-increasing value'),
      payload: Joi.any().required().description('any arbitrary JSON value, including the empty object')
    })
/*
    status: {
      400: Joi.object({
        boomlet: Joi.string().required().description('invalid timestamp')
      }),
      422: Joi.object({
        boomlet: Joi.string().required().description('timestamp mismatch')
      })
    }
 */
  }
}

module.exports.routes =
[
  braveHapi.routes.async().path('/v1/users/{userId}/appState').config(v1.get),
  braveHapi.routes.async().put().path('/v1/users/{userId}/appState').config(v1.put)
]

module.exports.initialize = async function (debug, runtime) {
  runtime.db.checkIndices(debug,
  [ { category: runtime.db.get('user_states'),
      name: 'user_states',
      property: 'userId',
      empty: { userId: '' },
      unique: [ { userId: 1 } ]
    },
    { category: runtime.db.get('app_states'),
      name: 'app_states',
      property: 'userId',
      empty: { userId: '', timestamp: bson.Timestamp.ZERO },
      unique: [ { userId: 1 } ],
      others: [ { timestamp: 1 } ]
    }
  ])
}
