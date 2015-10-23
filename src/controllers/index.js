var fs         = require('fs')
  , path       = require('path')
  , underscore = require('underscore')
  ;


var exports = {};


exports.routes = function (debug, runtime) {
    var entries = {}
      , routes  = [];

    fs.readdirSync(__dirname).forEach(function (name) {
        var module = require(path.join(__dirname, name));

        if (!underscore.isArray(module.routes)) { return; }

        if (typeof module.initialize === 'function') { module.initialize(debug, runtime); }

        module.routes.forEach(function (route) {
            var entry = route(runtime)
              , key   = entry.method + ' ' + entry.path
              ;

            if (entries[key]) { debug('duplicate route ' + key); } else { entries[key] = true; }
            routes.push(entry);
        });
    });

    return routes;
};


module.exports = exports;
