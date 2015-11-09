var Hapi = require('hapi')

var code = require('code')
var expect = code.expect

var Lab = require('lab')
var lab = exports.lab = Lab.script()
var after = lab.after
var before = lab.before
var experiment = lab.experiment
var test = lab.test

var mock = function (done) {
  var runtime = require('../src/runtime')
  var server = new Hapi.Server()

  server.connection()

  server.register([
    require('bell'),
    require('hapi-async-handler'),
    require('hapi-auth-cookie')
  ], function (err) {
    if (!err) {
      server.auth.strategy('github', 'bell', {
        provider: 'github',
        password: require('cryptiles').randomString(64),
        clientId: runtime.login.clientId,
        clientSecret: runtime.login.clientSecret,
        isSecure: runtime.login.isSecure,
        forceHttps: runtime.login.isSecure,
        scope: ['user:email', 'read:org']
      })

      server.auth.strategy('session', 'cookie', {
        password: 'cookie-encryption-password',
        cookie: 'sid',
        isSecure: runtime.login.isSecure
      })
    }

    if (err) {
      console.log(err.stack)
      throw err
    }
  })

  server.route(require('../src/controllers/index').routes(function () {}, runtime))
  server.start(function (err) {
    if (err) {
      console.log(err.stack)
      throw err
    }

    done(server)
  })
}

experiment('server tests', function () {
  var server

  before(function (done) {
    mock(function (result) { server = result })
    done()
  })

  after(function (done) {
    server.stop(done)
  })

  test('/ returns "Welcome to the Vault."', function (done) {
    server.inject({ method: 'get', url: '/' }, function (response) {
      expect(response.statusCode).to.equal(200)
      expect(response.result).to.equal('Welcome to the Vault.')

      done()
    })
  })
})
