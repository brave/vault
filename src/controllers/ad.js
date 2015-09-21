var debug = require('debug')('ad');

module.exports.get = function (runtime) {
  return async function (request, reply) {
    // Increment users.statAdReplaceCount
    var users = runtime.db.get('users');
    await users.update({
      userId: request.query.braveUserId
    },
    {
      '$inc': {'statAdReplaceCount': 1 }
    });

    var url = 'data:text/html,<html><body style="width: ' + request.query.width + 'px; height: ' + request.query.height + 'px; padding: 0; margin: 0;">' +
      '<img src="https://placeimg.com/' + request.query.width + '/' + request.query.height + '"/>' +
      '<div style="background-color:blue; color: white; font-weight: bold; position: absolute; top: 0;">Use Brave</div></body></html>';
    debug('serving ad for query ', request.query, ' with url: ', url);
    reply.redirect(url);
  };
};
