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
    var modifiers, query, result
    var id = request.query.id
    var limit = request.query.limit
    var since = request.query.since
    var siteInfo = runtime.db.get('site_info')

    if (id) {
      if (since) { return reply(boom.badData('since and id parameters may not both be present', request.query)) }

      if (!limit || limit === 1) {
        result = await siteInfo.findOne({ _id: id })
        return reply(result || {})
      }

      query = { _id: { $gte: siteInfo.oid(id) } }
      modifiers = { sort: { _id: 1 } }
    } else {
      try { since = (since || 0) ? bson.Timestamp.fromString(since) : bson.Timestamp.ZERO } catch (ex) {
        return reply(boom.badRequest('invalid since value', { since: since }))
      }

      limit = 100
      query = { timestamp: { $gte: since } }
      modifiers = { sort: { timestamp: 1 } }
    }

    result = await siteInfo.find(query, underscore.extend({ limit: limit }, modifiers))
    reply(result)
  }
},

auth:
  { strategy: 'session',
    scope: [ 'admin', 'devops' ],
    mode: 'required'
  },

validate:
  { query:
    { id: Joi.string().hex().optional(),
      limit: Joi.number().positive().optional(),
      since: Joi.string().regex(/^[0-9]+$/).min(19).optional()
    }
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

    reply(result)
  }
},

auth:
  { strategy: 'session',
    scope: [ 'admin', 'devops' ],
    mode: 'required'
  },

validate:
  { params:
    { hostname: Joi.string().hostname().required() }
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
    if (!result) { return reply(boom.badImplementation('database lookup failed', { hostname: hostname })) }

    reply(result)
  }
},

auth:
  { strategy: 'session',
    scope: [ 'admin', 'devops' ],
    mode: 'required'
  },

validate:
  { payload:
    { hostname: Joi.string().hostname().required(),
      timestamp: Joi.any().forbidden(),
      replacementAd: Joi.array().items(Joi.object().keys({ width: Joi.number().positive().required(),
                                                           height: Joi.number().positive().required(),
                                                           replaceId: Joi.string().required()
                                                         })).required()
    }
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
    if (!result) { return reply(boom.badImplementation('database lookup failed', { hostname: hostname })) }

    reply(result)
  }
},

auth:
  { strategy: 'session',
    scope: [ 'admin', 'devops' ],
    mode: 'required'
  },

validate:
  { params:
    { hostname: Joi.string().hostname().required() },
      payload:
    { hostname: Joi.any().forbidden(),
      timestamp: Joi.any().forbidden(),
      replacementAd: Joi.array().items(Joi.object().keys({ width: Joi.number().positive().required(),
                                                           height: Joi.number().positive().required(),
                                                           replaceId: Joi.string().required()
                                                           })).required()
    }
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
