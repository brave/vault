var debug = require('debug')('ad');

module.exports.get = function () {
  return function * (next) {
    if (this.method !== 'GET') {
      return yield next;
    }
    debug('serving ad', this.query);
    this.body = 'Hello this is ad for: ' + JSON.stringify(this.query);
  };
};
