var debug = require('debug')('users');

module.exports.push = function (runtime) {
  return async function (request, reply) {
    var user = request.payload;

    if (!user.userId) {
      throw new Error('a new user must have an id');
    }

    debug('registering user', user);

    var users = runtime.db.get('users');

    // Create a wallet for the user.
    try {
      var walletResult = await runtime.wallet.generate(user);

      user.wallet = {
        id: walletResult.wallet.id(),
        label: walletResult.wallet.label(),
        userKeychainEncryptedXprv: walletResult.userKeychain.encryptedXprv,
        backupKeychainEncryptedXprv: walletResult.backupKeychain.encryptedXprv
      };
    } catch(e) {
      debug('could not create wallet', e);
    }

    debug('new user', user);
    await users.insert(user);

    reply('OK!');
  };
};
