var monk = require('monk');

function DB(config) {
  this.config = config;
  this.db = monk(config.database);
}

DB.prototype = {
  get: function(collection) {
    return this.db.get(collection);
  }
};

module.exports = DB;
