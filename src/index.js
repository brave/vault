process.env.NEW_RELIC_NO_CONFIG_FILE = true
if (process.env.NEW_RELIC_APP_NAME && process.env.NEW_RELIC_LICENSE_KEY) { var newrelic = require('newrelic') }

var Hapi = require('hapi')

var braveHapi = require('./brave-hapi')
var debug = new (require('./sdebug'))('server')
var pack = require('./../package')
var routes = require('./controllers/index')
var underscore = require('underscore')

var runtime = require('./runtime.js')

var server = new Hapi.Server()
server.connection({ port: runtime.config.port })

debug.initialize({ 'server': { id: server.info.id } })

server.register(
[ require('bell'),
  require('blipp'),
  require('hapi-async-handler'),
  require('hapi-auth-cookie'),
  require('inert'),
  require('vision'),
  {
    register: require('hapi-swagger'),
    options: {
      apiVersion: pack.version,
      auth:
      { strategy: 'session',
        scope: [ 'admin', 'devops' ],
        mode: 'required'
      }
    }
  }
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

server.route(routes.routes(debug, runtime))

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

server.ext('onPreResponse', function (request, reply) {
  if ((!request.response.isBoom) || (request.response.output.statusCode !== 401)) return reply.continue()

  request.auth.session.clear()
  reply.redirect('/v1/login')
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
  var duration, flattened
  var logger = request._logger || []
  var params = { request:
                 { id: request.id,
                   method: request.method.toUpperCase(),
                   pathname: request.url.pathname,
                   statusCode: request.response.statusCode,
                   duration: (duration) && (duration / 1000)
                 },
                 headers: request.response.headers,
                 error: braveHapi.error.inspect(request.response._error)
               }

  logger.forEach(function (entry) {
    if ((entry.data) && (typeof entry.data.msec === 'number')) { duration = entry.data.msec }
  })

  if (request.response._error) {
    flattened = {}
    underscore.keys(params).forEach(param => {
      underscore.keys(params[param]).forEach(key => {
        if ((param === 'error') && ((key === 'message') || (key === 'payload') || (key === 'stack'))) return

        flattened[param + '.' + key] = params[param][key]
      })
    })
    flattened.url = flattened['request.pathname']
    delete flattened['request.pathname']
    newrelic.noticeError(request.response._error, flattened)
  }

  debug('end', { sdebug: params })
})

server.start(function (err) {
  if (err) {
    debug('unable to start server', err)
    throw err
  }

  debug('webserver started',
  { protocol: server.info.protocol,
    address: server.info.address,
    port: runtime.config.port,
    version: server.version
  })

  // Hook to notify start script.
  if (process.send) { process.send('started') }
})
