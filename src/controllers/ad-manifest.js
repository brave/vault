var boom = require('boom')
var braveHapi = require('../brave-hapi')
var bson = require('bson')
var Joi = require('joi')
var underscore = require('underscore')

var v1 = {}

/*
   GET /v1/ad-manfest?since={milliseconds since epoch}&limit={positive integer}
       defaults to since=0 limit=100

   GET /v1/ad-manifest?id={database key}&limit={positive integer}
       no default for id, limit=1

 */

v1.get =
{ handler: function (runtime) {
  return async function (request, reply) {
    var entries, modifiers, query, result
    var id = request.query.id
    var limit = request.query.limit
    var since = request.query.since
    var siteInfo = runtime.db.get('site_info')

    if (id) {
      if (since) { return reply(boom.badData('id and since parameters may not both be present', request.query)) }

      if (!limit || limit === 1) {
        result = await siteInfo.findOne({ _id: id })
        return reply(result || {})
      }

      query = { _id: { $gte: siteInfo.oid(id) } }
      modifiers = { sort: { _id: 1 } }
    } else {
      try { since = (since || 0) ? bson.Timestamp.fromString(since) : bson.Timestamp.ZERO } catch (ex) {
        return reply(boom.badRequest('invalid value for since parameter', { since: since }))
      }

      limit = 100
      query = { timestamp: { $gte: since } }
      modifiers = { sort: { timestamp: 1 } }
    }

    entries = await siteInfo.find(query, underscore.extend({ limit: limit }, modifiers))
    result = []
    entries.forEach(entry => {
      if (entry.hostname === '') return
      result.push(underscore.omit(underscore.extend(entry, { id: entry._id.toString() }), '_id', 'timestamp'))
    })

    reply(result)
  }
},

  auth:
    { strategy: 'session',
      scope: [ 'admin', 'devops' ],
      mode: 'required'
    },

  description: 'Incrementally return ad manifests for zero or more sites',
  notes: 'There are two ways to incrementally traverse the list of ad manifests: using either an "id" parameter corresponding to a previously retrieved ad manifest, or an "since" parameter corresponding to an opaque timestamp. Either parameter may be present, but not both. If the id" parameter is present, then the "limit" parameter defaults to "1". Otherwise, the "since" parameter defaults to "0000000000000000000" and the "limit" parameter defaults to "100". The result is a JSON array containing zero or more entries.',
  tags: ['api'],

  validate:
    { query:
      { id: Joi.string().hex().optional().description('the database identifier of the first entry to consider'),
        since: Joi.string().regex(/^[0-9]+$/).min(19).optional().description('an opaque, monotonically-increasing value'),
        limit: Joi.number().positive().optional().description('the maximum number of entries to return')
      }
    },

  response: {
    schema: Joi.array().items(Joi.object().keys({
      id: Joi.string().required().description('a UUID v4 value'),
      hostname: Joi.string().hostname().required().description('the site correponding to the ad manifest'),
      replacementAd: Joi.array().items(Joi.object().keys({
        width: Joi.number().positive().required().description('the ad\'s width in pixels'),
        height: Joi.number().positive().required().description('the ad\'s height in pixels'),
        replaceId: Joi.string().required().description('the ad\'s DOM identifier ')
      }).required())
    }))
/*
    status: {
      400: Joi.object({
        boomlet: Joi.string().required().description('invalid value for since parameter')
      }),
      422: Joi.object({
        boomlet: Joi.string().required().description('id and since parameters may not both be present')
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
    if (!result) { return reply(boom.notFound('ad-manifest entry does not exist', { hostname: hostname })) }
    result = underscore.omit(underscore.extend(result, { id: result._id.toString() }), '_id', 'timestamp')

    reply(result)
  }
},

  auth:
    { strategy: 'session',
      scope: [ 'admin', 'devops' ],
      mode: 'required'
    },

  description: 'Returns the ad manifest for a particular site',
  tags: ['api'],

  validate:
    { params:
      { hostname: Joi.string().hostname().required().description('the domain name of the site') }
    },

  response: {
    schema: Joi.object({
      id: Joi.string().required().description('a UUID v4 value'),
      hostname: Joi.string().hostname().required().description('the site correponding to the ad manifest'),
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
      await siteInfo.insert(underscore.extend(payload, { timestamp: bson.Timestamp.ZERO }))
    } catch (ex) {
      debug('insert error', ex)
      return reply(boom.badData('ad-manifest entry already exists', { hostname: hostname }))
    }

    result = await siteInfo.findOne({ hostname: hostname })
    if (!result) { return reply(boom.badImplementation('database creation failed', { hostname: hostname })) }
    result = underscore.omit(underscore.extend(result, { id: result._id.toString() }), '_id', 'timestamp')

    reply(result)
  }
},

  auth:
    { strategy: 'session',
      scope: [ 'admin', 'devops' ],
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
      id: Joi.string().required().description('a UUID v4 value'),
      hostname: Joi.string().hostname().required().description('the site correponding to the ad manifest'),
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
       update (entry MUST exist)
 */

v1.putHostname =
{ handler: function (runtime) {
  return async function (request, reply) {
    var result, state
    var hostname = request.params.hostname
    var siteInfo = runtime.db.get('site_info')

    result = await siteInfo.findOne({ hostname: hostname })
    if (!result) { return reply(boom.notFound('ad-manifest entry does not exist', { hostname: hostname })) }

    state = { $currentDate: { timestamp: { $type: 'timestamp' } },
              $set: request.payload
            }
    await siteInfo.update({ hostname: hostname }, state, { upsert: true })

    result = await siteInfo.findOne({ hostname: hostname })
    if (!result) { return reply(boom.badImplementation('database update failed', { hostname: hostname })) }
    result = underscore.omit(underscore.extend(result, { id: result._id.toString() }), '_id', 'timestamp')

    reply(result)
  }
},

  auth:
    { strategy: 'session',
      scope: [ 'admin', 'devops' ],
      mode: 'required'
    },

  description: 'Updates the ad manifest for a particular site',
  tags: ['api'],

  validate:
    { params:
      { hostname: Joi.string().hostname().required().description('the domain name of the site') },
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
      id: Joi.string().required().description('a UUID v4 value'),
      hostname: Joi.string().hostname().required().description('the site correponding to the ad manifest'),
      replacementAd: Joi.array().items(Joi.object().keys({
        width: Joi.number().positive().required().description('the ad\'s width in pixels'),
        height: Joi.number().positive().required().description('the ad\'s height in pixels'),
        replaceId: Joi.string().required().description('the ad\'s DOM identifier ')
      }).required())
    })
/*
    status: {
      404: Joi.object({
        boomlet: Joi.string().required().description('ad-manifest does not exist')
      }),
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
