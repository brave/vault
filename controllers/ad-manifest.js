var mockDB = {
  replacementAd: 'http://github.com'
};

module.exports.get = function *(next) {
  if (this.method !== 'GET') {
    return yield next;
  }
  this.body = JSON.stringify(mockDB);
};
