var DB = require('./db')

var profile = process.env.NODE_ENV || 'development'
var config = require('../config/config.' + profile + '.js')
var database = new DB(config)

module.exports = {
  config: config,
  db: database,
  login: config.login
}
