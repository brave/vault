var debug = require('debug')('ad-manifest')
var mockDB = {
  replacementAd: 'http://github.com'
};

module.exports.get = function *(next) {
  if (this.method !== 'GET') {
    return yield next;
  }
  debug('mockDB', mockDB);
  this.body = JSON.stringify(mockDB);
};
