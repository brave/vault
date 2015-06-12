var parse = require('co-body');
var debug = require('debug')('sync');

// TODO: Replace with some real storage
var storage = {};

module.exports.push = function * push(data, next) {
  debug('Storage: ', storage);
  if (this.method !== 'POST') {
    return yield next;
  }

  var state = yield parse.json(this, { limit: '10kb' });
  debug('state is:', state);

  if (!state.userId) {
    this.throw(400, 'state must have a userId!');
  }

  debug('Registering state: ', state);

  storage[state.userId] = state;
  debug('storage: ', storage);
  this.body = 'OK!';
};

module.exports.get = function * push(userId, next) {
  debug('getting state', userId);
  if (this.method !== 'GET') {
    return yield next;
  }

  this.body = storage[userId];
  debug('body', this.body);
};
