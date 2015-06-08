var mockDB = {
  replacementAd: 'http://github.com'
};

module.exports.get = function *(next) {
  if ('GET' != this.method) return yield next;
  this.body = JSON.stringify(mockDB);
};
