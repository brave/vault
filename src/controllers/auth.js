var debug = require('debug')('users');
var parse = require('co-body');

module.exports.push = function (runtime) {
  return function * (data, next) {
    if (this.method !== 'POST') {
      return yield next;
    }

    var user = yield parse.json(this, { limit: '10kb' });

    if (!user.userId) {
      this.throw(400, 'a new user must have an id');
    }

    debug('registering user', user);

    var users = runtime.db.get('users');

    // Create a wallet for the user.
    try {
      var walletResult = yield runtime.wallet.generate(user);

      debug('created walled', walletResult);
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
    yield users.insert(user);

    this.body = 'OK!';
  };
};
