var parse = require('co-body');
var debug = require('debug')('sync');

module.exports.push = function(runtime) {
  return function * (data, next) {
    if (this.method !== 'POST') {
      return yield next;
    }

    var state = yield parse.json(this, { limit: '10kb' });
    debug('state is:', state);

    if (!state.userId) {
      this.throw(400, 'state must have a userId!');
    }

    debug('Registering state: ', state);

    var userState = runtime.db.get('user_states');
    yield userState.update({userId: state.userId}, state, {upsert: true});
    this.body = 'OK!';
  };
};

module.exports.get = function(runtime) {
  return function * (userId, next) {
    debug('getting state', userId);
    if (this.method !== 'GET') {
      return yield next;
    }

    var userState = runtime.db.get('user_states');
    var resp = yield userState.findOne({userId: userId});

    resp = resp || {};

    this.body = resp;
    debug('body', resp);
  };
};
