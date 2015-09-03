function Wallet(config) {
  this.config = config;
  this.bitgo = new (require('bitgo')).BitGo({accessToken: config.bitogAccessToken});

  this.bitgo.authenticate({ username: config.bitgoUser, password: config.bitgoPassword}, function(err, result) {
    if (err) { console.dir(err); }
  });

}

Wallet.prototype = {

	generate: function * (user) {
    var walletLabel = 'Brave Wallet - ' + user.userId;

    return new Promise(function (resolve) {
      // Create the wallet
      this.bitgo.wallets().createWalletWithKeychains({'passphrase': this.config.bitgoPassword, 'label': walletLabel}, function(err, result) {
        if (err) { console.dir(err); resolve(); }
        resolve(result);
      });
    }.bind(this));
	}

};

module.exports = Wallet;
