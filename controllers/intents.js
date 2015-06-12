var debug = require('debug')('intents');
var parse = require('co-body');

// TODO: Replace with some real storage
var intents = [];

module.exports.push = function * push(data, next) {
  debug('intents', intents);
  if (this.method !== 'POST') {
    return yield next;
  }

  var intent = yield parse.json(this, { limit: '10kb' });

  if (!intent.type) {
    this.throw(400, 'intent must have a type!');
  }

  debug('registering intent', intent);

  intents.push(intent);
  debug('Intents', intents);
  this.body = 'OK!';
};
