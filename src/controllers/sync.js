var boom       = require('boom')
  , braveHapi  = require('../brave-hapi')
  , bson       = require('bson')
  , Joi        = require('joi')
  , underscore = require('underscore')
  ;


var v0 = {};


/*
   GET /sync/{userId}
 */

v0.get =
{ handler           : function (runtime) {
    return async function (request, reply) {
        var result
          , userId     = request.params.userId
          , userStates = runtime.db.get('user_states')
          ;

        result = await userStates.findOne({ userId : userId });
        reply(underscore.omit(result || {}, '_id'));
    };
  }

, validate               :
  { params               :
    { userId             : Joi.string().guid().required() }
  }
};


/*
   POST /sync
        { "userId": "...", ... }
 */

v0.post =
{ handler           : function (runtime) {
    return async function (request, reply) {
        var state      = request.payload
          , userStates = runtime.db.get('user_states')
          ;

        await userStates.update({ userId : state.userId }, state, { upsert : true });
        reply('OK!');
    };
  }

, validate               :
  { payload              :
    { userId             : Joi.string().guid().required()
    , payload            : Joi.any().optional()
    , frames             : Joi.any().optional()
    , sites              : Joi.any().optional()
    , closedFrames       : Joi.any().optional()
    , statAdReplaceCount : Joi.any().optional()
    , ui                 : Joi.any().optional()
    , activeFrameKey     : Joi.any().optional()
    , searchDetail       : Joi.any().optional()
    , contextMenuDetail  : Joi.any().optional()
    }
  }
};


var v1 = {};


/*
   GET /v1/users/{userId}/appState
 */

v1.get =
{ handler           : function (runtime) {
    return async function (request, reply) {
        var result
          , userId    = request.params.userId
          , appStates = runtime.db.get('app_states')
          ;

        result = await appStates.findOne({ userId : userId });
        if (!result) { return reply(boom.notFound('', { userId : userId })); }

        reply(underscore.omit(result, '_id', 'userId'));
    };
  }

, validate               :
  { params               :
    { userId             : Joi.string().guid().required() }
  }
};


/*
   PUT /v1/users/{userId}/appState
        { "timestamp": "...", "payload" : {} }
 */

v1.put =
{ handler           : function (runtime) {
    return async function (request, reply) {
        var count, result, state
          , userId    = request.params.userId
          , timestamp = request.payload.timestamp
          , appStates = runtime.db.get('app_states')
          ;

        state = { $currentDate : { timestamp : { $type : 'timestamp' } }
                , $set         : { userId    : userId
                                 , payload   : request.payload.payload
                                 }
                };
        if (timestamp) {
            try { timestamp = bson.Timestamp.fromString(timestamp); } catch(ex) {
                return reply(boom.badRequest('invalid timestamp', { timestamp : timestamp }));
            }

            count = await appStates.update({ userId : userId, timestamp : timestamp }, state, { upsert : false });
            if (typeof count === 'object') { count = count.nMatched; }
            if (count === 0) { return reply(boom.badData('timestamp mismatch', { timestamp : timestamp })); }
        } else {
            await appStates.update({ userId : userId }, state, { upsert : true });
        }

        result = await appStates.findOne({ userId : userId }, { timestamp : true });
        reply(underscore.omit(result, '_id'));
    };
  }

, validate               :
  { params               :
    { userId             : Joi.string().guid().required() }
  , payload              :
    { timestamp          : Joi.string().regex(/^[0-9]+$/).min(19).optional()
    , payload            : Joi.any().required()
    }
  }
};


module.exports.routes =
[ braveHapi.routes.async().path('/sync/{userId}').config(v0.get)
, braveHapi.routes.async().post().path('/sync').config(v0.post)
, braveHapi.routes.async().path('/v1/users/{userId}/appState').config(v1.get)
, braveHapi.routes.async().put().path('/v1/users/{userId}/appState').config(v1.put)
];


module.exports.initialize = async function (debug, runtime) {
    runtime.db.checkIndices(debug,
    [ { category : runtime.db.get('user_states')
      , name     : 'user_states'
      , property : 'userId'
      , empty    : { userId : '' }
      , unique   : [ { userId : 1 } ]
      }
    , { category : runtime.db.get('app_states')
      , name     : 'app_states'
      , property : 'userId'
      , empty    : { userId : '', timestamp : bson.Timestamp.ZERO }
      , unique   : [ { userId : 1 } ]
      , others   : [ { timestamp : 1 } ]
      }
    ]);
};
