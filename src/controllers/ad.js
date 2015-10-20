var boom       = require('boom')
  , braveHapi  = require('../brave-hapi')
  , Joi        = require('joi')
  ;


var v0 = {};


/*
   GET  /ad?braveUserId={userId}
 */

v0.get =
{ handler           : function (runtime) {
    return async function (request, reply) {
        var ad, count, image, url
          , debug  = braveHapi.debug(module, request)
          , height = request.query.height
          , userId = request.query.braveUserId
          , width  = request.query.width
          , users  = runtime.db.get('users')
          ;

        // Increment users.statAdReplaceCount
        count = await users.update({ userId : userId }, { $inc : { statAdReplaceCount : 1 } });
        if (typeof count === 'object') { count = count.nMatched; }
        if (count === 0) { return reply(boom.notFound('', { braveUserId: userId })); }

        // retrieve an ad for an intent and size
        ad = runtime.sonobi.adUnitForIntent(request.query, width, height);

        // TODO - refill the in memory caches
        // Warning - this is a fire and forget call - we are NOT
        // waiting for the results.
        runtime.sonobi.prefill();

        // What to do if there are no valid ads? server a placeholder?
        image = '<img src="https://placeimg.com/' + width + '/' + height + '"/>';

        // TODO - ensure ad.lp and ad.url are safe
        if (ad !== null) { image = '<a href="' + ad.lp + '" target="_blank"><img src="' + ad.url + '"/></a>'; }
        else { debug('default ad returned'); }

        url = 'data:text/html,<html><body style="width: ' + width
              + 'px; height: ' + height
              + 'px; padding: 0; margin: 0;">'
              + image
              + '<div style="background-color:blue; color: white; font-weight: bold; position: absolute; top: 0;">Use Brave</div></body></html>';

        debug('serving ad for query ', request.query, ' with url: ', url);
        reply.redirect(url);
    };
  }

, validate          :
  { query           :
    { braveUserId   : Joi.string().guid().required()
    , intentHost    : Joi.string().hostname().required()
    , tagName       : Joi.string().required()
    , width         : Joi.number().positive().required()
    , height        : Joi.number().positive().required()
    }
  }
};


module.exports.routes =
[ braveHapi.routes.async().path('/ad').config(v0.get)
];
