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
    reply(helper.add_nonce_data(runtime.npminfo))
  }
},

  description: 'Returns information about the server',
  tags: [ 'api' ],

  validate:
    { query: {} },

  response:
    { schema: helper.add_nonce_schema(Joi.any().description('static properties of the server')) }
}

module.exports.routes = [ braveHapi.routes.async().path('/v1/ping').config(v1.ping) ]
