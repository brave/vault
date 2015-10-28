process.env.NEW_RELIC_NO_CONFIG_FILE = true
if (process.env.NEW_RELIC_APP_NAME && process.env.NEW_RELIC_LICENSE_KEY) { require('newrelic') }

var Hapi = require('hapi')
var braveHapi = require('./brave-hapi')
var debug = require('./sdebug')('server')
var routes = require('./controllers/index')

var DB = require('./db')
var OIP = require('./oip')
// var Sonobi = require('./sonobi').Sonobi
var Wallet = require('./wallet')

var profile = process.env.NODE_ENV || 'development'
var config = require('../config/config.' + profile + '.js')
var database = new DB(config)
var runtime = {
  db: database,
  wallet: new Wallet(config),
//  sonobi: new Sonobi(config, database),
  oip: new OIP(config)
}

// TODO - do we wait for a pre-fill to complete before starting the server?
if (runtime.sonobi) runtime.sonobi.prefill()

var server = new Hapi.Server()
server.connection({ port: config.port })

server.register(
[ require('hapi-async-handler'),
  require('blipp')
], function (err) {
  if (err) { debug('error', err) }
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
            headers: request.headers,
            remote:
            { address: request.headers['x-forwarded-for'] || request.info.remoteAddress,
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
            duration: duration
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

  debug.initialize(
    { 'server':
      { id: server.info.id,
      protocol: server.info.protocol,
      address: server.info.address,
      port: config.port,
      version: server.version
      }
    })

  debug('webserver started on port', config.port)

// Hook to notify start script.
  if (process.send) { process.send('started') }
})
