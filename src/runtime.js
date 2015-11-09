var DB = require('./db')
var OIP = require('./oip')
var Wallet = require('./wallet')

var profile = process.env.NODE_ENV || 'development'
var config = require('../config/config.' + profile + '.js')
var database = new DB(config)

module.exports = {
  config: config,
  db: database,
  wallet: new Wallet(config),
  oip: new OIP(config),
  login: config.login
}
