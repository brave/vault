var boom       = require('boom')
  , braveHapi  = require('../brave-hapi')
  , bson       = require('bson')
  , helper     = require('./helper')
  , Joi        = require('joi')
  , underscore = require('underscore')
  ;


var v0 = {};


/*
   POST /intents
        { "type": "...", "userId": "...", ... }
 */

v0.post =
{ handler           : function (runtime) {
    return async function (request, reply) {
        var user
          , debug   = braveHapi.debug(module, request)
          , intent  = request.payload
          , userId  = intent.userId
          , intents = runtime.db.get('intents')
          , users   = runtime.db.get('users')
          ;

        user = await users.findOne({ userId : userId }, { userId : true, statAdReplaceCount : true });
        reply(underscore.omit(user, '_id'));

        try {
            await intents.insert(intent);
        } catch(ex) {
            debug('insert error', ex);
        }
    };
  }

, validate               :
  { payload              :
    { type               : Joi.string().min(6).required()
    , userId             : Joi.string().guid().required()
    , timestamp          : Joi.number().positive().optional()
    , payload            : Joi.object().optional()
    }
  }
};


var v1 = {};


/*
   POST /v1/users/{userId}/intents
        { "sessionID": "...", "type": "...", "timestamp": "...", "payload": "..." }
 */

v1.post =
{ handler           : function (runtime) {
    return async function (request, reply) {
        var intent, result
          , debug     = braveHapi.debug(module, request)
          , userId    = request.params.userId
          , sessionId = request.payload.sessionId
          , type      = request.payload.type
          , timestamp = request.payload.timestamp
          , payload   = request.payload.payload
          , intents   = runtime.db.get('intents')
          , sessions  = runtime.db.get('sessions')
          ;

        result = await helper.userId2stats(runtime, userId);
        if (!result) { return reply(boom.notFound('user entry does not exist', { userId : userId })); }
        reply(result);

        intent = { userId    : userId
                 , sessionID : sessionId
                 , type      : type
                 , timestamp : bson.Timestamp.ZERO
                 , payload   : underscore.extend(payload, { timestamp : timestamp })
                 };
        try {
            await intents.insert(intent);
        } catch(ex) {
            debug('insert error', ex);
        }

        try {
            await sessions.update({ sessionId : sessionId, userId : userId }
                                 , { $currentDate : { timestamp : { $type : 'timestamp' } }
                                   , $set         : { activity  : 'intent' }
                                   }
                                 , { upsert  : true });
        } catch(ex) {
            debug('update failed', ex);
        }
    };
  }

, validate               :
  { params               :
    { userId             : Joi.string().guid().required() }
  , payload              :
    { sessionId          : Joi.string().guid().required()
    , type               : Joi.string().min(6).required()
    , timestamp          : Joi.date().format('x').required()
    , payload            : Joi.object().required()
    }
  }
};


module.exports.routes =
[ braveHapi.routes.async().post().path('/intents').config(v0.post)
, braveHapi.routes.async().post().path('/v1/users/{userId}/intents').config(v1.post)
];


module.exports.initialize = async function (debug, runtime) {
    helper.checkIndices(debug,
    [ { category : runtime.db.get('intents')
      , name     : 'intents'
      , property : 'userId'
      , empty    : { userId : '', sessionId : '', timestamp : bson.Timestamp.ZERO }
      , others   : [ { userId : 1 }, { sessionId : 1 }, { timestamp : 1 } ]
      }
    ]);
};
