var boom       = require('boom')
  , braveHapi  = require('../brave-hapi')
  , Joi        = require('joi')
  , underscore = require('underscore')
  ;


var v0 = {};


/*
   GET  /ad-manfest?since={milliseconds since epoch}&limit={positive integer}
        defaults to since=0 limit=100

   GET  /ad-manifest?id={database key}&limit={positive integer}
        no default for id, limit=1

 */

v0.get =
{ handler           : function (runtime) {
    return async function (request, reply) {
        var modifiers, query, result
          , id       = request.query.id
          , limit    = request.query.limit
          , since    = request.query.since
          , siteInfo = runtime.db.get('site_info')
          ;

        if (id) {
            if (since) { return reply(boom.badData('since and id parameters may not both be present', request.query)); }

            if (!limit || limit === 1) {
              result = await siteInfo.findOne({ _id: id });
              return reply(result || {});
            }

            query = { _id: { $gte: siteInfo.oid(id) } };
            modifiers = { sort: { _id: 1 } };
        } else {
            since = since || 0;
            limit = 100;
            query = { lastUpdated: { $gte: new Date(since).getTime() } };
            modifiers = { sort: { lastUpdated: 1 } };
        }

        result = await siteInfo.find(query, underscore.extend({ limit: limit }, modifiers));

        reply(result);
    };
  }

, validate          :
  { query           :
    { id            : Joi.string().hex().optional()
    , limit         : Joi.number().positive().optional()
    , since         : Joi.date().format('x').optional()
    }
  }
};


/*
   GET  /ad-manifest/{hostname}
 */

v0.getHostname =
{ handler           : function (runtime) {
    return async function (request, reply) {
        var result
          , hostname = request.params.hostname
          , siteInfo = runtime.db.get('site_info')
          ;

        result = await siteInfo.findOne({ hostname : hostname });
        if (!result) { return reply(boom.notFound('', { hostname: hostname })); }

        reply(result);
    };
  }

, validate          :
  { params          :
    { hostname      : Joi.string().hostname().required()
    }
  }
};


/*
   POST /ad-manifest
        { "hostname": "...", "replacementAd": "..." }
        create (entry MUST not exist)
 */

v0.post =
{ handler           : function (runtime) {
    return async function (request, reply) {
        var result
          , debug    = braveHapi.debug(module, request)
          , state    = request.payload
          , siteInfo = runtime.db.get('site_info')
          ;

        try {
            await siteInfo.insert(underscore.extend(state, { lastUpdated: new Date().getTime() }));
        } catch(ex) {
            debug('insert error', ex);
            return reply(boom.badData('entry already exists', { hostname: state.hostname }));
        }

        result = await siteInfo.findOne({ hostname: state.hostname });
        if (!result) { return reply(boom.badImplementation('database lookup failed', { hostname: state.hostname })); }

        reply(result);
    };
  }

, validate          :
  { payload         :
    { hostname      : Joi.string().hostname().required()
    , replacementAd : Joi.array().items(Joi.object().keys({ width     : Joi.number().positive().required()
                                                          , height    : Joi.number().positive().required()
                                                          , replaceId : Joi.string().required()
                                                          })).required()
    , lastUpdated   : Joi.any().forbidden()
    }
  }
};


/*
   PUT /ad-manifest/{hostname}
        { "replacementAd": "..." }
        update (entry MUST exist)
 */

v0.putHostname =
{ handler           : function (runtime) {
    return async function (request, reply) {
        var result
          , hostname = request.params.hostname
          , state    = request.payload
          , siteInfo = runtime.db.get('site_info')
          ;

        result = await siteInfo.findOne({ hostname: hostname });
        if (!result) { return reply(boom.notFound()); }

        underscore.extend(result, state, { lastUpdated: new Date().getTime() });
        await siteInfo.update({ hostname: hostname }, result, { upsert: true });

        reply(result);
    };
  }

, validate          :
  { params          :
    { hostname      : Joi.string().hostname().required()
    }
  , payload         :
    { hostname      : Joi.any().forbidden()
    , replacementAd : Joi.array().items(Joi.object().keys({ width     : Joi.number().positive().required()
                                                          , height    : Joi.number().positive().required()
                                                          , replaceId : Joi.string().required()
                                                          })).required()
    , lastUpdated   : Joi.any().forbidden()
    }
  }
};


module.exports.routes =
[ braveHapi.routes.async().path('/ad-manifest').config(v0.get)
, braveHapi.routes.async().path('/ad-manifest/{hostname}').config(v0.getHostname)
, braveHapi.routes.async().post().path('/ad-manifest').config(v0.post)
, braveHapi.routes.async().put().path('/ad-manifest/{hostname}').config(v0.putHostname)
];

module.exports.initialize = async function (debug, runtime) {
    var doneP, indices
      , siteInfo = runtime.db.get('site_info')
      ;

    try { indices = await siteInfo.indexes(); } catch (ex) { indices = []; }
    doneP = underscore.keys(indices).indexOf('hostname_1') !== -1;

    debug('site_info indices ' + (doneP ? 'already' : 'being') + ' created');
    if (doneP) { return; }

    try {
        if (indices.length === 0) { await siteInfo.insert({ hostname: '' }); }

        await siteInfo.index({ hostname : 1 }, { unique : true });
    } catch (ex) {
        debug('unable to create site_info hostname index', ex);
    }
};
