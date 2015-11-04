var boom = require('boom')
var braveHapi = require('../brave-hapi')
var Joi = require('joi')
var underscore = require('underscore')

var v1 = {}

/*
   GET /v1/oip/ads/categories?compress={boolean}&format={boolean}
       defaults to compress=false, format=false
 */

v1.getCategories =
{ handler: function (runtime) {
  return async function (request, reply) {
    var categories, result
    var compressP = request.query.compress
    var formatP = request.query.format

    categories = runtime.oip.categories(formatP)
    if (compressP) {
      result = {}
      underscore.keys(categories).forEach(function (category) {
        var sizes = categories[category].sizes

        underscore.keys(sizes).forEach(function (size) {
          if (sizes[size].impressions === 0) return

          if (!result[category]) { result[category] = underscore.extend({}, categories[category], { sizes: {} }) }
          result[category].sizes[size] = sizes[size]
        })
      })
    } else {
      result = categories
    }

    if (!formatP) return reply(result)
    reply('<pre>' + JSON.stringify(result, null, 2) + '</pre>')
  }
},

  auth:
    { strategy: 'session',
      scope: 'devops',
      mode: 'required'
    },

  description: 'Returns detailed statistics about all OIP categories',
  notes: 'The "compress" parameter, if true, will not report on categories without ads. The "format" parameter, if true, will return HTML rather than JSON output.',
  tags: ['api'],

  validate:
    { query:
      { compress: Joi.boolean().optional().description('do not report categories without ads'),
        format: Joi.boolean().optional().description('report in HTML, not JSON')
      }
    }
}

/*
   GET /v1/oip/ads/categories/{category}&format={boolean}
       defaults to format=false
 */

v1.getCategory =
{ handler: function (runtime) {
  return async function (request, reply) {
    var result
    var category = request.params.category
    var formatP = request.query.format
    var categories = runtime.oip.categories(formatP)

    result = categories[category]
    if (!result) { return reply(boom.notFound('oip entry does not exist', { category: category })) }

    if (!formatP) return reply(result)
    reply('<pre>' + JSON.stringify(result, null, 2) + '</pre>')
  }
},

  auth:
    { strategy: 'session',
      scope: 'devops',
      mode: 'required'
    },

  description: 'Returns detailed statistics about a particular OIP category',
  notes: 'The "format" parameter, if true, will return HTML rather than JSON output.',
  tags: ['api'],

  validate:
    { query: { format: Joi.boolean().optional().description('report in HTML, not JSON') },
      params: { category: Joi.string() }
    }
}

/*
   GET /v1/oip/ads/statistics&format={boolean}
       defaults to format=false
 */

v1.getStatistics =
{ handler: function (runtime) {
  return async function (request, reply) {
    var formatP = request.query.format
    var result = runtime.oip.statistics(formatP)

    if (!formatP) return reply(result)
    reply('<pre>' + JSON.stringify(result, null, 2) + '</pre>')
  }
},

  auth:
    { strategy: 'session',
      scope: 'devops',
      mode: 'required'
    },

  description: 'Returns coarse-grain statistics about the OIP subsystem',
  notes: 'The "format" parameter, if true, will return HTML rather than JSON output.',
  tags: ['api'],

  validate:
    { query: { format: Joi.boolean().optional().description('report in HTML, not JSON') } }
}

module.exports.routes =
[ braveHapi.routes.async().path('/v1/oip/ads/categories').config(v1.getCategories),
  braveHapi.routes.async().path('/v1/oip/ads/categories/{category}').config(v1.getCategory),
  braveHapi.routes.async().path('/v1/oip/ads/statistics').config(v1.getStatistics)
]
