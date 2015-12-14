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

  if (typeof process.env.VAULT_COLLECTION_RESET === 'string') {
    process.env.VAULT_COLLECTION_RESET.split(',').forEach(collection => {
      try {
        runtime.db.get(collection).drop()
      } catch (ex) {
        debug('unable to reset ' + collection + ' collection: ' + ex.toString())
      }
    })
  }

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
