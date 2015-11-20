var boom = require('boom')
var braveHapi = require('../brave-hapi')
var bson = require('bson')
var helper = require('./helper')
var Joi = require('joi')
var natural = require('natural')
var underscore = require('underscore')

var tokenizer = new natural.WordTokenizer()

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

v1.post =
{ handler: function (runtime) {
  return async function (request, reply) {
    var intent, intentions, result, session, user
    var debug = braveHapi.debug(module, request)
    var userId = request.params.userId
    var container = request.payload.intent ? request.payload.intent : request.payload
    var sessionId = container.sessionId
    var type = container.type
    var timestamp = container.timestamp
    var payload = container.payload
    var users = runtime.db.get('users')
    var intents = runtime.db.get('intents')
    var sessions = runtime.db.get('sessions')

    user = await users.findOne({ userId: userId })
    if (!user) { return reply(boom.notFound('user entry does not exist: ' + userId)) }

    result = await helper.verify(debug, user, request.payload)
    if (result) return reply(result)

    reply(helper.sessionId2stats(runtime, userId, sessionId))

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

    if (type !== 'brave.site.visit') return

    try {
      // NB: calculation of session.intents is temporary
      session = await sessions.findOne({ sessionId: sessionId }, { intents: true })
      session = session || {}
      if (!payload.title) {
        payload.title = [ 'Arts',
                          'Entertainment',
                          'Automotive',
                          'Business',
                          'Careers',
                          'Education',
                          'Family',
                          'Parenting',
                          'Health',
                          'Fitness',
                          'Food',
                          'Drink',
                          'Hobbies',
                          'Interests',
                          'Home',
                          'Garden',
                          'Law',
                          'Government',
                          'Politics',
                          'News',
                          'Personal Finance',
                          'Society',
                          'Science',
                          'Pets',
                          'Sports',
                          'Style',
                          'Fashion',
                          'Technology',
                          'Computing',
                          'Travel',
                          'Real Estate',
                          'Shopping',
                          'Religion',
                          'Spirituality'
                        ].join(', ')
      }
      intentions = underscore.union(session.intents || [], underscore.uniq(tokenizer.tokenize(payload.title.toLowerCase())))

      await sessions.update({ sessionId: sessionId },
                             { $currentDate: { timestamp: { $type: 'timestamp' } },
                               $set: { activity: 'intent', intents: intentions }
                             },
                             { upsert: true })
    } catch (ex) {
      debug('update failed', ex)
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
    schema: Joi.object().keys({
      replacements: Joi.number().min(0).optional().description('the number of ad replacements for this session')
    })

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
