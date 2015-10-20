var braveHapi  = require('../brave-hapi')
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
          , debug      = braveHapi.debug(module, request)
          , userId     = request.params.userId
          , userStates = runtime.db.get('user_states')
          ;

        result = await userStates.findOne({ userId : userId });
        result = underscore.omit(result || {}, '_id');

        debug('result=', result);
        reply(result);
    };
  }

, validate          :
  { params          :
    { userId        : Joi.string().guid().required()
    }
  }
};


/*
   POST /sync
        { "userId": "...", ... }
 */

v0.post =
{ handler           : function (runtime) {
    return async function (request, reply) {
        var debug      = braveHapi.debug(module, request)
          , state      = request.payload
          , userStates = runtime.db.get('user_states')
          ;

        debug('state is:', state);

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


module.exports.routes =
[ braveHapi.routes.async().path('/sync/{userId}').config(v0.get)
, braveHapi.routes.async().post().path('/sync').config(v0.post)
];

module.exports.initialize = async function (debug, runtime) {
    var doneP, indices
      , userStates = runtime.db.get('user_states')
      ;

    try { indices = await userStates.indexes(); } catch (ex) { indices = []; }
    doneP = underscore.keys(indices).indexOf('userId_1') !== -1;

    debug('user_states indices ' + (doneP ? 'already' : 'being') + ' created');
    if (doneP) { return; }

    try {
        if (indices.length === 0) { await userStates.insert({ userId: '' }); }

        await userStates.index({ userId : 1 }, { unique : true });
    } catch (ex) {
        debug('unable to create user_states userId index', ex);
    }
};
