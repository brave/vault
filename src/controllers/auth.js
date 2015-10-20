var boom       = require('boom')
  , braveHapi  = require('../brave-hapi')
  , Joi        = require('joi')
  , underscore = require('underscore')
  ;


var v0 = {};


/*
   POST  /auth
         { "userId": "..." }
        create (entry MUST not exist)
 */

v0.post =
{ handler           : function (runtime) {
    return async function (request, reply) {
        var walletResult
          , debug = braveHapi.debug(module, request)
          , user  = request.payload
          , users = runtime.db.get('users')
          ;

        try {
            walletResult = await runtime.wallet.generate(user);

            user.wallet =
            { id                          : walletResult.wallet.id()
            , label                       : walletResult.wallet.label()
            , userKeychainEncryptedXprv   : walletResult.userKeychain.encryptedXprv
            , backupKeychainEncryptedXprv : walletResult.backupKeychain.encryptedXprv
            };
        } catch(ex) {
            debug('wallet error', ex);
//          return reply(boom.badImplementation('wallet creation failed', ex));
        }

        try {
            await users.insert(user);
        } catch(ex) {
            debug('insert error', ex);
            return reply(boom.badData('entry already exists', { userId: user.userId }));
        }

        debug('user=', user);
        reply('OK!');
      };
  }

, validate          :
  { payload         :
    { userId        : Joi.string().guid().required() }
  }
};


module.exports.routes =
[ braveHapi.routes.async().post().path('/auth').config(v0.post)
];

module.exports.initialize = async function (debug, runtime) {
    var doneP, indices
      , users = runtime.db.get('users')
      ;

    try { indices = await users.indexes(); } catch (ex) { indices = []; }
    doneP = underscore.keys(indices).indexOf('userId_1') !== -1;

    debug('users indices ' + (doneP ? 'already' : 'being') + ' created');
    if (doneP) { return; }

    try {
        if (indices.length === 0) { await users.insert({ userId: '' }); }

        await users.index({ userId : 1 }, { unique : true });
    } catch (ex) {
        debug('unable to create users userId index', ex);
    }
};
