var fs = require('fs')
var path = require('path')
var underscore = require('underscore')

var exports = {}

exports.routes = function (debug, runtime) {
  var entries = {}
  var routes = [
    { method: 'GET',
      path: '/',
      config:
        { handler: function (request, reply) {
          reply('Welcome to the Vault.')
        }
      }
    }
  ]

  fs.readdirSync(__dirname).forEach(name => {
    var module = require(path.join(__dirname, name))

    if (!underscore.isArray(module.routes)) { return }

    if (typeof module.initialize === 'function') { module.initialize(debug, runtime) }

    module.routes.forEach(route => {
      var entry = route(runtime)
      var key = entry.method + ' ' + entry.path

      if (entries[key]) { debug('duplicate route ' + key) } else { entries[key] = true }
      routes.push(entry)
    })
  })

  return routes
}

module.exports = exports
