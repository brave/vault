var DB = require('./database')

var profile = process.env.NODE_ENV || 'development'
var config = require('../config/config.' + profile + '.js')

module.exports = {
  config: config,
  db: new DB(config),
  login: config.login
}
