var debug = require('debug')('ad');

module.exports.get = function () {
  return function * (next) {
    if (this.method !== 'GET') {
      return yield next;
    }
    var url = 'data:text/html,<html style="background-color:white"><body style="background-color: red; width: ' + this.query.width + 'px; height: ' + this.query.height + 'px">hi</body></html>';
    debug('serving ad for query ', this.query, ' with url: ', url);
    this.redirect(url);
  };
};
