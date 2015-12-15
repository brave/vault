var debug = new (require('./sdebug'))('wallet')

var Wallet = function (config) {
  if (!(this instanceof Wallet)) { return new Wallet(config) }

  this.config = config
  this.bitgo = new (require('bitgo')).BitGo({ accessToken: config.bitgoAccessToken, env: 'prod' })
  debug('environment: ' + this.bitgo.env)
}

Wallet.prototype =
{ generate:
  async function (user, xpub) {
    return new Promise(function (resolve) {
      this.bitgo.wallets().createWalletWithKeychains({ passphrase: this.config.bitgoPassword,
                                                       label: 'brave://vault/persona/' + user.userId,
                                                       backupXpub: xpub
                                                     }, function (err, result) {
        if (err) {
          debug('error creating wallet', err)
          result = null
        }
        resolve(result)
      })
    }.bind(this))
  },

  balance:
  async function (id) {
    return new Promise(function (resolve) {
      this.bitgo.wallets().get({ type: 'bitcoin', id: id }, function (err, wallet) {
        var result

        if (err) {
          debug('error fetching wallet', err)
          result = null
        } else {
          result = (wallet.balance() / 1e8).toFixed(4)
        }
        resolve(result)
      })
    }.bind(this))
  }
}

module.exports = Wallet
