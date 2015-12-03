var braveHapi = require('../brave-hapi')
var helper = require('./helper')
var Joi = require('joi')

var v1 = {}

/*
   GET /v1/ping
 */

v1.ping =
{ handler: function (runtime) {
  return async function (request, reply) {
    // reply(helper.add_nonce_data(Joi.any()))
    reply(Joi.object({
      header: Joi.object({
        nonce: Joi.string().required().description('a time-based, monotonically-increasing value')
      }).required(),
      payload: Joi.any().required()
    }))
  }
},

  description: 'Returns information about the server',
  notes: 'This operation authenticates either an administrative role ("devops") for the vault. The user is asked to authenticate their GitHub identity, and are assigned permissions based on team-membership. Operations are henceforth authenticated via an encrypted session cookie.',
  tags: ['api'],

  validate:
    { query: {}
    },

  response:
    { schema: helper.add_nonce_schema(Joi.any())
    }
}

module.exports.routes =
[ braveHapi.routes.async().path('/v1/ping').config(v1.ping)
]
