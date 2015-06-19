var monk = require('monk');
var wrap = require('co-monk');

function DB(config) {
  this.config = config;
  this.db = monk(config.database);
}

DB.prototype = {
  get: function(collection) {
    return wrap(this.db.get(collection));
  }
};

module.exports = DB;
