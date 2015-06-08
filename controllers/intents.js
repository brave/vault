var parse = require('co-body');

// TODO: Replace with some real storage
var intents = [];

module.exports.push = function * push(data,next) {
  console.log('Intents: ', intents);
  if ('POST' != this.method) return yield next;

  var intent = yield parse.json(this, { limit: '10kb' });

  if (!intent.type) {
    this.throw(400, 'intent must have a type!');
  }

  console.log('Registering intent: ', intent);

  intents.push(intent);
  console.log('Intents: ', intents);
  this.body = 'OK!';
};
