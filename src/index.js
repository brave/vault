process.env.NEW_RELIC_NO_CONFIG_FILE = true
if (process.env.NEW_RELIC_APP_NAME && process.env.NEW_RELIC_LICENSE_KEY) { require('newrelic') }

var Hapi = require('hapi')
var braveHapi = require('./brave-hapi')
var debug = new (require('./sdebug'))('server')
var routes = require('./controllers/index')
var underscore = require('underscore')

var DB = require('./db')
var OIP = require('./oip')
var Wallet = require('./wallet')

var profile = process.env.NODE_ENV || 'development'
var config = require('../config/config.' + profile + '.js')
var database = new DB(config)
var runtime = {
  db: database,
  wallet: new Wallet(config),
  oip: new OIP(config),
  login: config.login
}

var server = new Hapi.Server()
server.connection({ port: config.port })

debug.initialize({ 'server': { id: server.info.id } })

server.register(
[ require('bell'),
  require('blipp'),
  require('hapi-async-handler'),
  require('hapi-auth-cookie')
], function (err) {
  if (err) {
    debug('unable to register extensions', err)
    throw err
  }

  debug('extensions registered')

  server.auth.strategy('github', 'bell', {
    provider: 'github',
    password: require('cryptiles').randomString(64),
    clientId: runtime.login.clientId,
    clientSecret: runtime.login.clientSecret,
    isSecure: runtime.login.isSecure,
    forceHttps: runtime.login.isSecure,
    scope: ['user:email', 'read:org']
  })
  debug('github authentication: forceHttps=' + runtime.login.isSecure)

  server.auth.strategy('session', 'cookie', {
    password: 'cookie-encryption-password',
    cookie: 'sid',
    isSecure: runtime.login.isSecure
  })
})

server.route(
  [
    { method: 'GET',
      path: '/',
      config:
      { handler: function (request, reply) {
        request.log([], 'Welcome to the Vault.')
        reply('Welcome to the Vault.')
      },
      validate: undefined
      }
    }
  ].concat(routes.routes(debug, runtime)))

server.ext('onRequest', function (request, reply) {
  debug('begin',
        { sdebug:
          { request:
            { id: request.id,
              method: request.method.toUpperCase(),
              pathname: request.url.pathname
            },
            query: request.url.query,
            params: request.url.params,
            headers: underscore.omit(request.headers, 'cookie'),
            remote:
            { address: (request.headers['x-forwarded-for'] || request.info.remoteAddress).split(', ')[0],
              port: request.headers['x-forwarded-port'] || request.info.remotePort
            }
          }
        })

  return reply.continue()
})

server.on('log', function (event, tags) {
  debug(event.data, { tags: tags })
}).on('request', function (request, event, tags) {
  debug(event.data,
        { tags: tags },
        { sdebug:
          { request:
            { id: event.request,
              internal: event.internal
            }
          }
        })
}).on('response', function (request) {
  var duration

  (request._logger || []).forEach(function (entry) {
    if ((entry.data) && (typeof entry.data.msec === 'number')) { duration = entry.data.msec }
  })

  debug('end',
        { sdebug:
          { request:
            { id: request.id,
            statusCode: request.response.statusCode,
            duration: (duration) && (duration / 1000)
            },
          headers: request.response.headers,
          error: braveHapi.error.inspect(request.response._error)
          }
        })
})

server.start(function (err) {
  if (err) {
    debug('unable to start server', err)
    throw err
  }

  debug('webserver started',
  { protocol: server.info.protocol,
    address: server.info.address,
    port: config.port,
    version: server.version
  })

// Hook to notify start script.
  if (process.send) { process.send('started') }
})
