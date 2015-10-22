var boom       = require('boom')
  , braveHapi  = require('../brave-hapi')
  , helper     = require('./helper')
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

        count = await users.update({ userId : userId }, { $inc : { statAdReplaceCount : 1 } }, { upsert : true });
        if (typeof count === 'object') { count = count.nMatched; }
        if (count === 0) { return reply(boom.notFound('user entry does not exist', { braveUserId : userId })); }

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

, validate               :
  { query                :
    { braveUserId        : Joi.string().guid().required()
    , intentHost         : Joi.string().hostname().required()
    , tagName            : Joi.string().required()
    , width              : Joi.number().positive().required()
    , height             : Joi.number().positive().required()
    }
  }
};


var v1 = {};


/*
   GET  /v1/users/{userId}/ad?...
 */

v1.get =
{ handler           : function (runtime) {
    return async function (request, reply) {
        var ad, count, image, url
          , debug  = braveHapi.debug(module, request)
          , height = request.query.height
          , width  = request.query.width
          , userId = request.params.userId
          , users  = runtime.db.get('users')
          ;

        count = await users.update({ userId : userId }, { $inc : { statAdReplaceCount : 1 } }, { upsert : false });
        if (typeof count === 'object') { count = count.nMatched; }
        if (count === 0) { return reply(boom.notFound('user entry does not exist', { braveUserId : userId })); }

        ad = runtime.sonobi.adUnitForIntent(request.query, width, height);

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

        try { runtime.sonobi.prefill(); } catch(ex) { debug('prefill failed', ex); }
    };
  }

, validate               :
  { query                :
    { sessionId          : Joi.string().guid().required()
    , tagName            : Joi.string().required()
    , width              : Joi.number().positive().required()
    , height             : Joi.number().positive().required()
    }
  , params               :
    { userId             : Joi.string().guid().required() }
  }
};


/*
   GET  /v1/ad-clicks/{adUnitId}
 */

v1.getClicks =
{ handler           : function (/* runtime */) {
    return async function (/* request, reply */) {
    };
  }

, validate               :
  { params               :
    { adUnitId           : Joi.string().guid().required() }
  }
};


module.exports.routes =
[ braveHapi.routes.async().path('/ad').config(v0.get)
, braveHapi.routes.async().path('/v1/users/{userId}/ad').config(v1.get)
, braveHapi.routes.async().path('/v1/ad-clicks/{adUnitId}').config(v1.getClicks)
];


module.exports.initialize = async function (debug, runtime) {
    helper.checkIndices(debug,
    [ { category : runtime.db.get('ad_units')
      , name     : 'ad_units'
      , property : 'adUnitId'
      , empty    : { adUnitId : '', sessionId : '' }
      , unique   : [ { adUnitId : 1 } ]
      , others   : [ { sessionId : 1 } ]
      }
    ]);
};
