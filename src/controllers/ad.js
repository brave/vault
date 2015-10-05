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
    var ad = runtime.son.ad_unit_for_intent(request.query,
				    request.query.width,
				    request.query.height);

    // TODO - refill the in memory caches
    // Warning - this is a fire and forget call - we are NOT
    // waiting for the results.
    runtime.son.prefill();

    // What to do if there are no valid ads? server a placeholder?
    var img_html = '<img src="https://placeimg.com/' + request.query.width + '/' + request.query.height + '"/>';

    // TODO - ensure ad.lp and ad.url are safe
    if (ad !== null) {
	img_html = '<a href="' + ad.lp + '" target="_blank"><img src="' + ad.url + '"/></a>';
    } else {
 	console.log("default ad returned");
    }

    var url = 'data:text/html,<html><body style="width: ' +
              request.query.width +
              'px; height: ' +
              request.query.height +
              'px; padding: 0; margin: 0;">' +
              img_html +
              '<div style="background-color:blue; color: white; font-weight: bold; position: absolute; top: 0;">Use Brave</div></body></html>';

    debug('serving ad for query ', request.query, ' with url: ', url);
    reply.redirect(url);
  };
};
