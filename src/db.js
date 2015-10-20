var monk       = require('monk');


var DB = function(config) {
    if (!(this instanceof DB)) { return new DB(config); }

    this.config = config;
    this.db = monk(config.database);
};

DB.prototype.get = function (collection) {
    return this.db.get(collection);
};


module.exports = DB;
