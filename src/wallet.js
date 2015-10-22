var debug      = require('./sdebug')('wallet');


var Wallet = function (config) {
    if (!(this instanceof Wallet)) { return new Wallet(config); }

    this.config = config;
    this.bitgo = new (require('bitgo')).BitGo({accessToken : config.bitgoAccessToken});

    this.bitgo.authenticate({ username : config.bitgoUser, password : config.bitgoPassword}, function(err) {
        if (err) { debug('authentication', err); }
    });
};

Wallet.prototype =
{ generate : async function(user) {
    var walletLabel = 'Brave Wallet - ' + user.userId;

    return new Promise(function (resolve) {
      // Create the wallet
        this.bitgo.wallets().createWalletWithKeychains({'passphrase': this.config.bitgoPassword, 'label': walletLabel},
                                                       function(err, result) {
            if (err) {
                // TODO: We should queue of retry failed API requests.
                debug('error creating wallet. BitGo api key may be invalid, you can safely ignore wallet errors for now.', err);
                resolve();
                return;
            }
            resolve(result);
        });
    }.bind(this));
  }
};


module.exports = Wallet;
