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

    // retrieve an ad for an intent and size
    var ad = runtime.sonobi.adUnitForIntent(request.query,
      request.query.width,
      request.query.height);

    // TODO - refill the in memory caches
    // Warning - this is a fire and forget call - we are NOT
    // waiting for the results.
    runtime.sonobi.prefill();

    // What to do if there are no valid ads? server a placeholder?
    var image = '<img src="https://placeimg.com/' + request.query.width + '/' + request.query.height + '"/>';

    // TODO - ensure ad.lp and ad.url are safe
    if (ad !== null) {
      image = '<a href="' + ad.lp + '" target="_blank"><img src="' + ad.url + '"/></a>';
    } else {
      debug('default ad returned');
    }

    var url = 'data:text/html,<html><body style="width: ' +
              request.query.width +
              'px; height: ' +
              request.query.height +
              'px; padding: 0; margin: 0;">' +
              image +
              '<div style="background-color:blue; color: white; font-weight: bold; position: absolute; top: 0;">Use Brave</div></body></html>';

    debug('serving ad for query ', request.query, ' with url: ', url);
    reply.redirect(url);
  };
};
