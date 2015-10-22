var underscore = require('underscore')
  ;


var exports = {};


exports.userId2stats = async function (runtime, userId) {
    var user
      , users = runtime.db.get('users')
      ;

    user = await users.findOne({ userId : userId }, { statAdReplaceCount : true });
    if (!user) { return undefined; }

    return { replacements : user.statAdReplaceCount };
};


exports.checkIndices = async function (debug, entries) {
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

module.exports = exports;
