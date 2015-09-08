var debug = require('debug')('ad-manifest');
var mockDB = {
  replacementAd: 'http://github.com'
};

module.exports.get = function () {
  return async function (request, reply) {
    debug('mockDB', mockDB);
    reply(JSON.stringify(mockDB));
  };
};
