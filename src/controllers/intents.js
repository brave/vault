var debug = require('debug')('intents');
var parse = require('co-body');

module.exports.push = function (runtime) {
  return function * (data, next) {
    if (this.method !== 'POST') {
      return yield next;
    }

    var intent = yield parse.json(this, { limit: '10kb' });

    if (!intent.type) {
      this.throw(400, 'intent must have a type!');
    }

    debug('registering intent', intent);

    var intents = runtime.db.get('intents');
    yield intents.insert(intent);

    // Return the user record as a response.
    var users = runtime.db.get('users');
    var user = yield users.find({
        userId: intent.userId
      }, {
        userId: true,
        statAdReplaceCount: true
      });
    this.body = user[0];
  };
};
