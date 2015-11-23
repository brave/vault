var boom = require('boom')
var braveHapi = require('../brave-hapi')
var bson = require('bson')
var Joi = require('joi')
var underscore = require('underscore')

var v1 = {}

/*
   GET /v1/ad-manifest[? [since={milliseconds since epoch}&] [limit={positive integer}] ]
       defaults to since=0 limit=100

 */

v1.get =
{ handler: function (runtime) {
  return async function (request, reply) {
    var entries, modifiers, query, result
    var limit = parseInt(request.query.limit, 10)
    var timestamp = request.query.timestamp
    var siteInfo = runtime.db.get('site_info')

    try { timestamp = (timestamp || 0) ? bson.Timestamp.fromString(timestamp) : bson.Timestamp.ZERO } catch (ex) {
      return reply(boom.badRequest('invalid value for the timestamp parameter: ' + timestamp))
    }

    if (isNaN(limit) || (limit > 100)) limit = 100
    query = { timestamp: { $gte: timestamp } }
    modifiers = { sort: { timestamp: 1 } }

    entries = await siteInfo.find(query, underscore.extend({ limit: limit }, modifiers))
    result = []
    entries.forEach(entry => {
      if (entry.hostname === '') return
      result.push(underscore.extend(underscore.omit(entry, '_id', 'timestamp'),
                                    { timestamp: entry.timestamp.toString() }))
    })

    reply(result)
  }
},

  description: 'Incrementally returns ad manifests for zero or more sites',
  notes: 'The "timestamp" parameter corresponding to an opaque value, defaulting to "0". The "limit" parameter defaults to "100". The result is a JSON array containing zero or more entries.',
  tags: ['api'],

  validate:
    { query:
      { timestamp: Joi.string().regex(/^[0-9]+$/).optional().description('an opaque, monotonically-increasing value'),
        limit: Joi.number().positive().optional().description('the maximum number of entries to return')
      }
    },

  response: {
    schema: Joi.array().items(Joi.object().keys({
      hostname: Joi.string().hostname().required().description('the domain name of the site'),
      timestamp: Joi.string().required().description('an opaque, monotonically-increasing value'),
      replacementAd: Joi.array().items(Joi.object().keys({
        width: Joi.number().positive().required().description('the ad\'s width in pixels'),
        height: Joi.number().positive().required().description('the ad\'s height in pixels'),
        replaceId: Joi.string().required().description('the ad\'s DOM identifier ')
      }).required())
    }))
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
   GET /v1/ad-manifest/{hostname}
 */

v1.getHostname =
{ handler: function (runtime) {
  return async function (request, reply) {
    var result
    var hostname = request.params.hostname
    var siteInfo = runtime.db.get('site_info')

    result = await siteInfo.findOne({ hostname: hostname })
    if (!result) { return reply(boom.notFound('ad-manifest entry does not exist: ' + hostname)) }
    result = underscore.extend(underscore.omit(result, '_id', 'timestamp'), { timestamp: result.timestamp.toString() })

    reply(result)
  }
},

  description: 'Returns the ad manifest for a particular site',
  tags: ['api'],

  validate:
    { params:
      { hostname: Joi.string().hostname().required().description('the domain name of the site') }
    },

  response: {
    schema: Joi.object({
      hostname: Joi.string().hostname().required().description('the domain name of the site'),
      timestamp: Joi.string().required().description('an opaque, monotonically-increasing value'),
      replacementAd: Joi.array().items(Joi.object().keys({
        width: Joi.number().positive().required().description('the ad\'s width in pixels'),
        height: Joi.number().positive().required().description('the ad\'s height in pixels'),
        replaceId: Joi.string().required().description('the ad\'s DOM identifier ')
      }).required())
    })
/*
    status: {
      404: Joi.object({
        boomlet: Joi.string().required().description('ad-manifest entry does not exist')
      })
    }
 */
  }
}

/*
   POST /v1/ad-manifest
        { "hostname": "...", "replacementAd": "..." }
        create (entry MUST not exist)
 */

v1.post =
{ handler: function (runtime) {
  return async function (request, reply) {
    var result
    var debug = braveHapi.debug(module, request)
    var payload = request.payload
    var hostname = payload.hostname
    var siteInfo = runtime.db.get('site_info')

    try {
      await siteInfo.insert(underscore.extend(payload, { timestamp: bson.Timestamp() }))
    } catch (ex) {
      debug('insert error', ex)
      return reply(boom.badData('ad-manifest entry already exists: ' + hostname))
    }

    result = await siteInfo.findOne({ hostname: hostname })
    if (!result) { return reply(boom.badImplementation('database creation failed: ' + hostname)) }
    result = underscore.extend(underscore.omit(result, '_id', 'timestamp'), { timestamp: result.timestamp.toString() })

    reply(result)
  }
},

  auth:
    { strategy: 'session',
      scope: [ 'devops' ],
      mode: 'required'
    },

  description: 'Creates the ad manifest for a particular site',
  tags: ['api'],

  validate:
    { payload:
      { hostname: Joi.string().hostname().required().description('the domain name of the site'),
        timestamp: Joi.any().forbidden(),
        replacementAd: Joi.array().items(Joi.object().keys({ width: Joi.number().positive().required().description('the ad\'s width in pixels'),
                                                             height: Joi.number().positive().required().description('the ad\'s height in pixels'),
                                                             replaceId: Joi.string().required().description('the ad\'s DOM identifier ')
                                                           })).required()
      }
    },

  response: {
    schema: Joi.object({
      hostname: Joi.string().hostname().required().description('the domain name of the site'),
      timestamp: Joi.string().required().description('an opaque, monotonically-increasing value'),
      replacementAd: Joi.array().items(Joi.object().keys({
        width: Joi.number().positive().required().description('the ad\'s width in pixels'),
        height: Joi.number().positive().required().description('the ad\'s height in pixels'),
        replaceId: Joi.string().required().description('the ad\'s DOM identifier ')
      }).required())
    })
/*
    status: {
      422: Joi.object({
        boomlet: Joi.string().required().description('ad-manifest entry already exists')
      }),
      500: Joi.object({
        boomlet: Joi.string().required().description('database creation failed')
      })
    }
 */
  }
}

/*
   PUT /v1/ad-manifest/{hostname}
       { "replacementAd": "..." }
        create/update (entry MAY already exist)
 */

v1.putHostname =
{ handler: function (runtime) {
  return async function (request, reply) {
    var result, state
    var hostname = request.params.hostname
    var siteInfo = runtime.db.get('site_info')

    state = { $currentDate: { timestamp: { $type: 'timestamp' } },
              $set: request.payload
            }
    await siteInfo.update({ hostname: hostname }, state, { upsert: true })

    result = await siteInfo.findOne({ hostname: hostname })
    if (!result) { return reply(boom.badImplementation('database update failed: ' + hostname)) }
    result = underscore.extend(underscore.omit(result, '_id', 'timestamp'), { timestamp: result.timestamp.toString() })

    reply(result)
  }
},

  auth:
    { strategy: 'session',
      scope: [ 'devops' ],
      mode: 'required'
    },

  description: 'Sets the ad manifest for a particular site',
  tags: ['api'],

  validate:
    { params: { hostname: Joi.string().hostname().required().description('the domain name of the site') },
      payload:
      { hostname: Joi.any().forbidden(),
        timestamp: Joi.any().forbidden(),
        replacementAd: Joi.array().items(Joi.object().keys({ width: Joi.number().positive().required(),
                                                             height: Joi.number().positive().required(),
                                                             replaceId: Joi.string().required()
                                                           })).required()
      }
    },

  response: {
    schema: Joi.object({
      hostname: Joi.string().hostname().required().description('the domain name of the site'),
      timestamp: Joi.string().required().description('an opaque, monotonically-increasing value'),
      replacementAd: Joi.array().items(Joi.object().keys({
        width: Joi.number().positive().required().description('the ad\'s width in pixels'),
        height: Joi.number().positive().required().description('the ad\'s height in pixels'),
        replaceId: Joi.string().required().description('the ad\'s DOM identifier ')
      }).required())
    })
/*
    status: {
      500: Joi.object({
        boomlet: Joi.string().required().description('database update failed')
      })
    }
 */
  }
}

module.exports.routes =
[ braveHapi.routes.async().path('/v1/ad-manifest').config(v1.get),
  braveHapi.routes.async().path('/v1/ad-manifest/{hostname}').config(v1.getHostname),
  braveHapi.routes.async().post().path('/v1/ad-manifest').config(v1.post),
  braveHapi.routes.async().put().path('/v1/ad-manifest/{hostname}').config(v1.putHostname)
]

module.exports.initialize = async function (debug, runtime) {
  runtime.db.checkIndices(debug,
  [ { category: runtime.db.get('site_info'),
      name: 'site_info',
      property: 'hostname',
      empty: { hostname: '', timestamp: bson.Timestamp.ZERO },
      unique: [ { hostname: 1 } ],
      others: [ { timestamp: 1 } ]
    }
  ])
}
