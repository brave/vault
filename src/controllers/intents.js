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
 */

v1.post =
{ handler: function (runtime) {
  return async function (request, reply) {
    var intent, intentions, result, session
    var debug = braveHapi.debug(module, request)
    var userId = request.params.userId
    var sessionId = request.payload.sessionId
    var type = request.payload.type
    var timestamp = request.payload.timestamp
    var payload = request.payload.payload
    var intents = runtime.db.get('intents')
    var sessions = runtime.db.get('sessions')

    result = await helper.userId2stats(runtime, userId)
    if (!result) { return reply(boom.notFound('user entry does not exist', { userId: userId })) }
    reply(result)

    intent = { userId: userId,
               sessionID: sessionId,
               timestamp: bson.Timestamp.ZERO,
               type: type,
               payload: underscore.extend(payload, { timestamp: timestamp })
             }
    try {
      await intents.insert(intent)
    } catch (ex) {
      debug('insert error', ex)
    }

    try {
      // NB: calculation of session.intents is temporary
      session = await sessions.findOne({ sessionId: sessionId }, { intents: true })
      session = session || {}
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
      payload:
      { sessionId: Joi.string().guid().required().description('the identity of the session'),
        type: Joi.string().min(6).required().description('e.g., "browser.site.visit"'),
        timestamp: Joi.date().format('x').required().description('opaque number identifying a instance of time'),
        payload: Joi.object().required().description('an opaque JSON object')
      }
    },

  response: {
    schema: Joi.object().keys({
      replacements: Joi.number().min(0).optional().description('the number of ad replacements for this session')
    })

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
[
  braveHapi.routes.async().post().path('/v1/users/{userId}/intents').config(v1.post)
]

module.exports.initialize = async function (debug, runtime) {
// NB: this block is temporary to fix a schema issue
  try {
    var Promise = require('monk/lib/promise')

    var z = function (fn) {
      var promise = new Promise(this, 'indexes')

      if (fn) promise.complete(fn)

      debug('%s indexInformation', 'intents')
      runtime.db.get('intents').col.dropAllIndexes(promise.resolve)

      return promise
    }

    await z()
  } catch (ex) { debug(ex) }

  runtime.db.checkIndices(debug,
  [ { category: runtime.db.get('intents'),
      name: 'intents',
      property: 'userId',
      empty: { userId: '', sessionId: '', timestamp: bson.Timestamp.ZERO, type: '', payload: {} },
      others: [ { userId: 0 }, { sessionId: 1 }, { timestamp: 1 } ]
    }
  ])
}
