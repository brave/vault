var braveHapi = require('../brave-hapi')
var fs = require('fs')
var helper = require('./helper')
var Joi = require('joi')
var path = require('path')
var underscore = require('underscore')

var npminfo
try { npminfo = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'package.json'))) } catch (err) { }

var v1 = {}

/*
   GET /v1/ping
 */

v1.ping =
{ handler: function (runtime) {
  return async function (request, reply) {
    reply(helper.add_nonce_data(underscore.pick(npminfo,
                                                'name', 'version', 'description', 'author', 'license', 'bugs', 'homepage')))
  }
},

  description: 'Returns information about the server',
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
