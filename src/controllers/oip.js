var boom = require('boom')
var braveHapi = require('../brave-hapi')
var Joi = require('joi')
var underscore = require('underscore')

var v1 = {}

/*
   GET  /oip/ads/categories
 */

v1.getCategories =
{ handler: function (runtime) {
  return async function (request, reply) {
    var categories, result
    var compress = request.query.compress

    categories = runtime.oip.categories()
    if (!compress) { return reply(categories) }

    result = {}
    underscore.keys(categories).forEach(function (category) {
      var sizes = categories[category].sizes

      underscore.keys(sizes).forEach(function (size) {
        if (sizes[size].impressions === 0) return

        if (!result[category]) { result[category] = underscore.extend({}, categories[category], { sizes: {} }) }
        result[category].sizes[size] = sizes[size]
      })
    })

    reply('<pre>' + JSON.stringify(result, null, 2) + '</pre>')
  }
},

auth:
  { strategy: 'session',
    scope: 'devops',
    mode: 'required'
  },

validate:
  { query:
    { compress: Joi.boolean().optional()
    }
  }
}

/*
   GET  /oip/ads/statistics
 */

v1.getStatistics =
{ handler: function (runtime) {
  return async function (request, reply) {
    var result = runtime.oip.statistics()

    reply('<pre>' + JSON.stringify(result, null, 2) + '</pre>')
  }
},

auth:
  { strategy: 'session',
    scope: 'devops',
    mode: 'required'
  },

validate:
  { query: {}
  }
}

/*
   GET  /oip/ads/categories/{category}
 */

v1.getCategory =
{ handler: function (runtime) {
  return async function (request, reply) {
    var result
    var category = request.params.category
    var categories = runtime.oip.categories()

    result = categories[category]
    if (!result) { return reply(boom.notFound('oip entry does not exist', { category: category })) }

    reply('<pre>' + JSON.stringify(result, null, 2) + '</pre>')
  }
},

auth:
  { strategy: 'session',
    scope: 'devops',
    mode: 'required'
  },

validate:
  { params:
    { category: Joi.number().positive() }
  }
}

module.exports.routes =
[ braveHapi.routes.async().path('/v1/oip/ads/categories').config(v1.getCategories),
  braveHapi.routes.async().path('/v1/oip/ads/statistics').config(v1.getStatistics),
  braveHapi.routes.async().path('/v1/oip/ads/categories/{category}').config(v1.getCategory)
]
