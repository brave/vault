var braveHapi  = require('../brave-hapi')
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
          , intents = runtime.db.get('intents')
          , users   = runtime.db.get('users')
          ;

        debug('payload=', intent);
        await intents.insert(intent);

        user = await users.find({ userId : intent.userId }, { userId : true, statAdReplaceCount : true });
        reply(underscore.omit(user[0], '_id'));
    };
  }

, validate          :
  { payload         :
    { type          : Joi.string().min(6).required()
    , userId        : Joi.string().guid().required()
    , timestamp     : Joi.number().positive().optional()
    , payload       : Joi.object().optional()
    }
  }
};


module.exports.routes =
[ braveHapi.routes.async().post().path('/intents').config(v0.post)
];
