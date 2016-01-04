var boom = require('boom')
var braveHapi = require('../brave-hapi')
var bson = require('bson')
var helper = require('./helper')
var Joi = require('joi')
var underscore = require('underscore')

var v1 = {}

var sessionSchema = Joi.object().keys({
  userId: Joi.string().guid().required().description('the identity of the user entry'),
  sessionId: Joi.string().guid().required().description('the identity of the session'),
  type: Joi.string().min(1).required().description('the name of the type'),
  header: Joi.object({
    signature: Joi.string().required().description('a digital signature calculated over userId:nonce:JSON.stringify(payload)'),
    nonce: Joi.string().required().description('a time-based, monotonically-increasing value')
  }).required(),
  payload: Joi.object().required().keys({
    iv: Joi.string().min(1).required().description('a once-only initialization vector'),
    encryptedData: Joi.string().min(1).required()
  }),
  timestamp: Joi.string().required().description('an opaque, monotonically-increasing value')
})

/*
   GET /v1/users/{userId}/sessions[? [since={milliseconds since epoch}&] [limit={positive integer}] ]
       defaults to since=0 limit=100

 */

v1.getSessions =
{ handler: function (runtime) {
  return async function (request, reply) {
    var entries, modifiers, query, result
    var userId = request.params.userId.toUpperCase()
    var limit = parseInt(request.query.limit, 10)
    var timestamp = request.query.timestamp
    var type = request.query.type
    var sessions = runtime.db.get('sessions')

    try { timestamp = (timestamp || 0) ? bson.Timestamp.fromString(timestamp) : bson.Timestamp.ZERO } catch (ex) {
      return reply(boom.badRequest('invalid value for the timestamp parameter: ' + timestamp))
    }

    if (isNaN(limit) || (limit > 100)) limit = 100
    query = { userId: userId, timestamp: { $gte: timestamp } }
    if (type) query.type = type
    modifiers = { sort: { timestamp: 1 } }

    entries = await sessions.find(query, underscore.extend({ limit: limit }, modifiers))
    result = []
    entries.forEach(entry => {
      result.push(underscore.extend(underscore.omit(entry, '_id', 'timestamp'),
                                    { timestamp: entry.timestamp.toString() }))
    })

    reply(helper.add_nonce_data(result))
  }
},

  description: 'Incrementally returns session information for a user entry',
  notes: 'The "timestamp" parameter corresponding to an opaque value, defaulting to "0". The "limit" parameter defaults to "100". The result is a JSON array containing zero or more entries.',
  tags: ['api'],

  validate:
    { params: { userId: Joi.string().guid().required().description('the identity of the user entry') },
      query:
      { timestamp: Joi.string().regex(/^[0-9]+$/).optional().description('an opaque, monotonically-increasing value'),
        limit: Joi.number().positive().optional().description('the maximum number of entries to return'),
        type: Joi.string().min(1).optional().description('the name of the type')
      }
    },

  response: {
    schema: helper.add_nonce_schema(Joi.array().items(sessionSchema))
/*
    status: {
      400: Joi.object({
        boomlet: Joi.string().required().description('invalid value for the timestamp parameter')
      })
    }
 */
  }
}

/*
   GET /v1/users/{userId}/sessions/{sessionId}/{types}[? [since={milliseconds since epoch}&] [limit={positive integer}] ]
       defaults to since=0 limit=100

 */

v1.getTypes =
{ handler: function (runtime) {
  return async function (request, reply) {
    var entries, modifiers, query, result
    var userId = request.params.userId.toUpperCase()
    var sessionId = request.params.sessionId.toUpperCase()
    var limit = parseInt(request.query.limit, 10)
    var timestamp = request.query.timestamp
    var sessions = runtime.db.get('sessions')

    try { timestamp = (timestamp || 0) ? bson.Timestamp.fromString(timestamp) : bson.Timestamp.ZERO } catch (ex) {
      return reply(boom.badRequest('invalid value for the timestamp parameter: ' + timestamp))
    }

    if (isNaN(limit) || (limit > 100)) limit = 100
    query = { userId: userId, sessionId: sessionId, timestamp: { $gte: timestamp } }
    modifiers = { sort: { timestamp: 1 } }

    entries = await sessions.find(query, underscore.extend({ limit: limit }, modifiers))
    result = []
    entries.forEach(entry => {
      result.push(underscore.extend(underscore.omit(entry, '_id', 'timestamp'),
                                    { timestamp: entry.timestamp.toString() }))
    })

    reply(helper.add_nonce_data(result))
  }
},

  description: 'Incrementally returns state information for a session',
  notes: 'The "timestamp" parameter corresponding to an opaque value, defaulting to "0". The "limit" parameter defaults to "100". The result is a JSON array containing zero or more entries.',
  tags: ['api'],

  validate:
    { params:
      { userId: Joi.string().guid().required().description('the identity of the user entry'),
        sessionId: Joi.string().guid().required().description('the identity of the session')
      },
      query:
      { timestamp: Joi.string().regex(/^[0-9]+$/).optional().description('an opaque, monotonically-increasing value'),
        limit: Joi.number().positive().optional().description('the maximum number of entries to return')
      }
    },

  response: {
    schema: helper.add_nonce_schema(Joi.array().items(sessionSchema))
/*
    status: {
      400: Joi.object({
        boomlet: Joi.string().required().description('invalid value for the timestamp parameter')
      })
    }
 */
  }
}

/*
   GET /v1/users/{userId}/sessions/{sessionId}/types/{type}
 */

v1.getSessionType =
{ handler: function (runtime) {
  return async function (request, reply) {
    var result
    var userId = request.params.userId.toUpperCase()
    var sessionId = request.params.sessionId.toUpperCase()
    var type = request.params.type
    var sessions = runtime.db.get('sessions')

    result = await sessions.findOne({ userId: userId, sessionId: sessionId, type: type })
    if (!result) { return reply(boom.notFound('user/session/type entry does not exist')) }
    result = underscore.extend(underscore.omit(result, '_id', 'timestamp'), { timestamp: result.timestamp.toString() })

    reply(helper.add_nonce_data(result))
  }
},

  description: 'Returns session information for a particular user entry',
  tags: ['api'],

  validate:
    { params:
      { userId: Joi.string().guid().required().description('the identity of the user entry'),
        sessionId: Joi.string().guid().required().description('the identity of the session'),
        type: Joi.string().min(1).required().description('the name of the type')
      }
    },

  response: {
    schema: helper.add_nonce_schema(sessionSchema)
/*
    status: {
      404: Joi.object({
        boomlet: Joi.string().required().description('session/type entry does not exist')
      })
    }
 */
  }
}

/*
   PUT /v1/users/{userId}/sessions/{sessionId}/types/{type}
        create/update (entry MAY already exist)
 */

v1.putSessionType =
{ handler: function (runtime) {
  return async function (request, reply) {
    var result, state, user
    var debug = braveHapi.debug(module, request)
    var userId = request.params.userId.toUpperCase()
    var sessionId = request.params.sessionId.toUpperCase()
    var type = request.params.type
    var users = runtime.db.get('users')
    var sessions = runtime.db.get('sessions')

    user = await users.findOne({ userId: userId })
    if (!user) { return reply(boom.notFound('user entry does not exist: ' + userId)) }

    result = await helper.verify(debug, user, request.payload)
    if (result) return reply(result)

    state = { $currentDate: { timestamp: { $type: 'timestamp' } },
              $set: request.payload
            }
    await sessions.update({ userId: userId, sessionId: sessionId, type }, state, { upsert: true })

    reply(helper.add_nonce_data({}))
  }
},

  description: 'Records session information for a particular user entry',
  tags: ['api'],

  validate:
    { params:
      { userId: Joi.string().guid().required().description('the identity of the user entry'),
        sessionId: Joi.string().guid().required().description('the identity of the session'),
        type: Joi.string().min(1).required().description('the name of the type')
      },
      payload: helper.add_header_schema(Joi.object().keys({
        iv: Joi.string().min(1).required().description('a once-only initialization vector'),
        encryptedData: Joi.string().min(1).required()
      }))
    },

  response: {
    schema: helper.add_nonce_schema(Joi.any())
/*
    status: {
      400: Joi.object({
        boomlet: Joi.string().required().description('payload is not cryptographically-signed')
      }),
      400: Joi.object({
        boomlet: Joi.string().required().description('unknown user entry cryptography version')
      }),
      400: Joi.object({
        boomlet: Joi.string().required().description('header.nonce is invalid')
      }),
      404: Joi.object({
        boomlet: Joi.string().required().description('user entry does not exist')
      }),
      422: Joi.object({
        boomlet: Joi.string().required().description('user entry is not cryptographically-enabled')
      }),
      422: Joi.object({
        boomlet: Joi.string().required().description('header.nonce is untimely')
      }),
      422: Joi.object({
        boomlet: Joi.string().required().description('signature error')
      })
      500: Joi.object({
        boomlet: Joi.string().required().description('database update failed')
      })
    }
 */
  }
}

/*
   DELETE /v1/users/{userId}/sessions/{sessionId}/types/{type}
 */

v1.delete =
{ handler: function (runtime) {
  return async function (request, reply) {
    if (!request.query) request.query = {}

    var result, user
    var debug = braveHapi.debug(module, request)
    var userId = request.params.userId.toUpperCase()
    var sessionId = request.params.sessionId.toUpperCase()
    var type = request.params.type
    var users = runtime.db.get('users')
    var sessions = runtime.db.get('sessions')

    user = await users.findOne({ userId: userId })
    if (!user) { return reply(boom.notFound('user entry does not exist: ' + userId)) }

    result = await helper.verify(debug, user, request.query.message)
    if (result) return reply(result)

    result = await sessions.remove({ userId: userId, sessionId: sessionId, type: type })

    reply().code(204)
  }
},

  description: 'Delete session information for a particular user entry',
  notes: 'For the purpose authentication the HTTP body must be present and contain a header/payload pairing, the payload may be any JSON value.',
  tags: ['api'],

  validate:
    { params:
      { userId: Joi.string().guid().required().description('the identity of the user entry'),
        sessionId: Joi.string().guid().required().description('the identity of the session'),
        type: Joi.string().min(1).required().description('the name of the type')
      },
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
[ braveHapi.routes.async().path('/v1/users/{userId}/sessions').config(v1.getSessions),
  braveHapi.routes.async().path('/v1/users/{userId}/sessions/{sessionId}/types').config(v1.getTypes),
  braveHapi.routes.async().path('/v1/users/{userId}/sessions/{sessionId}/types/{type}').config(v1.getSessionType),
  braveHapi.routes.async().put().path('/v1/users/{userId}/sessions/{sessionId}/types/{type}').config(v1.putSessionType),
  braveHapi.routes.async().delete().path('/v1/users/{userId}/sessions/{sessionId}/types/{type}').config(v1.delete)
]

module.exports.initialize = async function (debug, runtime) {
  runtime.db.checkIndices(debug,
  [ { category: runtime.db.get('sessions'),
      name: 'sessions',
      property: 'sessionId',
      empty: { userId: '', sessionId: '', type: '', timestamp: bson.Timestamp.ZERO },
      others: [ { userId: 1 }, { sessionId: 1 }, { type: 1 }, { timestamp: 1 } ]
    }
  ])
}
