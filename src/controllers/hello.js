var boom = require('boom')
var braveHapi = require('../brave-hapi')
var GitHub = require('github')
var Joi = require('joi')

var v1 = {}

/*
   GET  /v1/hello
 */

v1.hello =
{ handler: function (runtime) {
  return async function (request, reply) {
    var debug = braveHapi.debug(module, request)
    var credentials = request.auth.credentials

    if (!request.auth.isAuthenticated) return reply(boom.forbidden())

    request.auth.session.set(credentials)

    var gh = new GitHub({ version: '3.0.0', debug: false })
    gh.authenticate({ type: 'token', token: credentials.token })
    gh.user.getTeams({}, function (err, data) {
      if (err) return reply('Oops!')

      credentials.scope = []
      data.forEach(function (team) {
        if (team.organization.login === runtime.hello.organization) credentials.scope.push(team.name)
      })

      debug('login  ' + credentials.provider + ' ' + credentials.profile.email + ': ' + JSON.stringify(credentials.scope))
      return reply.redirect(runtime.hello.world)
    })
  }
},

auth: 'github',

validate:
  { query:
    { code: Joi.string().optional(),
      state: Joi.string().optional()
    }
  }
}

/*
   GET /v1/goodbye
 */

v1.goodbye =
{ handler: function (runtime) {
  return async function (request, reply) {
    var debug = braveHapi.debug(module, request)
    var credentials = request.auth.credentials

    debug('logout ' + credentials.provider + ' ' + credentials.profile.email + ': ' + JSON.stringify(credentials.scope))

    request.auth.session.clear()
    reply.redirect(runtime.hello.bye)
  }
},

auth:
  { strategy: 'session',
    mode: 'required'
  },

validate:
  { query: {}
  }
}

module.exports.routes =
[ braveHapi.routes.async().path('/v1/hello').config(v1.hello),
  braveHapi.routes.async().path('/v1/goodbye').config(v1.goodbye)
]
