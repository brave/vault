var debug = require('debug')('ad');

module.exports.get = function (runtime) {
  return function * (next) {
    if (this.method !== 'GET') {
      return yield next;
    }

    // Increment users.statAdReplaceCount
    var users = runtime.db.get('users');
    var user = yield users.find({
      userId: this.query.braveUserId
    });
    yield users.update({
      userId: this.query.braveUserId
    },
    {
      '$inc' : {'statAdReplaceCount': 1 }
    });

    var url = 'data:text/html,<html style="background-color:white"><body style="background-color: red; width: ' + this.query.width + 'px; height: ' + this.query.height + 'px">hi</body></html>';
    debug('serving ad for query ', this.query, ' with url: ', url);
    this.redirect(url);
  };
};
