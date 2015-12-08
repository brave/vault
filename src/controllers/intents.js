var boom = require('boom')
var braveHapi = require('../brave-hapi')
var bson = require('bson')
var helper = require('./helper')
var Joi = require('joi')
var underscore = require('underscore')

var v1 = {}

/*
   POST /v1/users/{userId}/intents
        { "sessionID": "...", "type": "...", "timestamp": "...", "payload": "..." }
        always creates
 */

var intentSchema = Joi.object().keys({
  sessionId: Joi.string().guid().required().description('the identity of the session'),
  type: Joi.string().min(6).required().description('e.g., "browser.site.visit"'),
  timestamp: Joi.number().positive().required().description('opaque number identifying a instance of time'),
  payload: Joi.object().required().description('an opaque JSON object')
})

var resultSchema = Joi.object().keys({
  replacements: Joi.number().min(0).optional().description('the number of ad replacements for this session')
})

v1.post =
{ handler: function (runtime) {
  return async function (request, reply) {
    var intent, result, user
    var debug = braveHapi.debug(module, request)
    var userId = request.params.userId
    var container = request.payload.intent ? request.payload.intent : request.payload
    var sessionId = container.sessionId
    var type = container.type
    var timestamp = container.timestamp
    var payload = container.payload
    var users = runtime.db.get('users')
    var intents = runtime.db.get('intents')

    user = await users.findOne({ userId: userId })
    if (!user) { return reply(boom.notFound('user entry does not exist: ' + userId)) }

    result = await helper.verify(debug, user, request.payload)
    if (result) return reply(result)

    result = await helper.sessionId2stats(runtime, userId, sessionId)
    // NB: alternatives is temporary
    reply(user.version ? helper.add_nonce_data(result) : result)

    intent = { userId: userId,
               sessionID: sessionId,
               timestamp: bson.Timestamp(),
               type: type,
               payload: underscore.extend(payload, { timestamp: timestamp })
             }
    try {
      await intents.insert(intent)
    } catch (ex) {
      debug('insert error', ex)
    }
  }
},

  description: 'Records user activity',
  notes: 'The browser uses this to indicate <a href="https://github.com/brave/vault/wiki/Intents" target="_blank">user activity</a>, such as clicking on a link.',
  tags: ['api'],

  validate:
    { params: { userId: Joi.string().guid().required().description('the identity of the user entry') },
      payload: Joi.alternatives(intentSchema,
                                Joi.object().keys({ envelope: Joi.any().required(), intent: intentSchema }))
    },

  response: {
    schema: Joi.alternatives(resultSchema, helper.add_nonce_schema(resultSchema))       // NB: alternatives is temporary

/*
    status: {
      400: Joi.object({
        boomlet: Joi.string().required().description('payload is not cryptographically-signed')
      }),
      400: Joi.object({
        boomlet: Joi.string().required().description('unknown user entry cryptography version')
      }),
      400: Joi.object({
        boomlet: Joi.string().required().description('envelope.nonce is invalid')
      }),
      404: Joi.object({
        boomlet: Joi.string().required().description('user entry does not exist')
      }),
      422: Joi.object({
        boomlet: Joi.string().required().description('user entry is not cryptographically-enabled')
      }),
      422: Joi.object({
        boomlet: Joi.string().required().description('envelope.nonce is untimely')
      }),
      422: Joi.object({
        boomlet: Joi.string().required().description('signature error')
      })
    }
 */
  }
}

module.exports.routes =
[
  braveHapi.routes.async().post().path('/v1/users/{userId}/intents').config(v1.post)
]

module.exports.initialize = async function (debug, runtime) {
  runtime.db.checkIndices(debug,
  [ { category: runtime.db.get('intents'),
      name: 'intents',
      property: 'userId',
      empty: { userId: '', sessionId: '', timestamp: bson.Timestamp.ZERO, type: '', payload: {} },
      others: [ { userId: 0 }, { sessionId: 1 }, { timestamp: 1 } ]
    }
  ])
}
