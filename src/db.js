var monk       = require('monk')
  , underscore = require('underscore')
  ;

var DB = function (config) {
    if (!(this instanceof DB)) { return new DB(config); }

    this.config = config;
    this.db = monk(config.database);
};

DB.prototype.get = function (collection) {
    return this.db.get(collection);
};

DB.prototype.checkIndices = async function (debug, entries) {
    entries.forEach(async function (entry) {
        var doneP, indices
          , category = entry.category
          ;

        try { indices = await category.indexes(); } catch (ex) { indices = []; }
        doneP = underscore.keys(indices).indexOf(entry.property + '_1') !== -1;

        debug(entry.name + ' indices ' + (doneP ? 'already' : 'being') + ' created');
        if (doneP) { return; }

        try {
            if (indices.length === 0) { await category.insert(entry.empty); }

            (entry.unique || []).forEach(async function (index) {
                await category.index(index, { unique : true });
            });
            (entry.others || []).forEach(async function (index) {
                await category.index(index, { unique : false });
            });
        } catch (ex) {
            debug('unable to create ' + entry.name + ' ' + entry.property + ' index', ex);
        }
    });
};

module.exports = DB;
