#!/usr/bin/env babel-node

/*
   babel-node example.js [-f config.json] [-s server] [-v] command args ...
 */

var bitgo = require('../node_modules/bitgo')
var fs = require('fs')
var http = require('http')
var https = require('https')
var path = require('path')
var querystring = require('querystring')
var underscore = require('../node_modules/underscore')
var url = require('url')
var util = require('util')
var webcrypto = require('./msrcrypto.js')

/*
 *
 * parse the command arguments
 *
 */

var usage = function (command) {
  if (typeof command !== 'string') command = 'get|put|rm [ args... ]'
  console.log('usage: babel-node ' + path.basename(process.argv[1]) + ' [ -f file ] [ -v ] [ -s https://... ] ' + command)
  process.exit(1)
}

usage.get = function () {
  usage('get [ -u personaID ] [ -s \'*\' | [ -t type [ -s sessionId ] ] ]')
}

usage.put = function () {
  usage('put [ -t type [ -s sessionID ] ] [ JSON.stringify(...) ]')
}

usage.rm = function () {
  usage('rm [ -t type [ -s sessionID ] ]')
}

var argv = process.argv.slice(2)
var configFile = process.env.CONFIGFILE || 'config.json'
var server = process.env.SERVER || 'https://vault-staging.brave.com'
var verboseP = process.env.VERBOSE || false

while (argv.length > 0) {
  if (argv[0].indexOf('-') !== 0) break

  if (argv[0] === '-v') {
    verboseP = true
    argv = argv.slice(1)
    continue
  }

  if (argv.length === 1) usage()

  if (argv[0] === '-f') configFile = argv[1]
  else if (argv[0] === '-s') server = argv[1]
  else usage()

  argv = argv.slice(2)
}
if (server.indexOf('http') !== 0) server = 'https://' + server
server = url.parse(server)

/*
 *
 * read/create the configuration file
 *
 * if a configuration file already exists, then the Web Cryptography API is used to import the key used by the browsers for
 * symmetric encryption (runtime.masterKey), and the private key bused by the browser to authenticate with the vault
 * (runtime.pair.private)
 *
 * if a configuration file does not exist, then the BitGo API is used to generate a keychain that will be used for a subsequent
 * BTC wallet creation
 *
 * then the Web Cryptography API is used to generate:
 *  - the symmetric key (config.masterKey), unknown to the vault, used by browsers to encipher private data
 *  - the keypair (config.privateKey/config.publicKey), used by browsers to authenticate modifications at the vault
 *    (config.privateKey is unknown to the vault)
 *
 * note that the use of ECDSA/P-256 is MANDATORY for talking to the current version of the vault -- there is no negotation...
 *
 *
 * if a configuration file already existed, then run() is called to process the command; otherwise, create() is called to
 * create the persona and then process the command
 */

var config
var runtime = {}

fs.readFile(configFile, { encoding: 'utf8' }, function (err, data) {
  var keychain

  if (err) {
    keychain = new (bitgo).BitGo({ env: 'prod' }).keychains().create()

    config = { userId: uuid(), sessionId: uuid(), xpub: keychain.xpub, xprv: keychain.xprv }
  } else {
    config = JSON.parse(data)
  }

  if (config.masterKey) {
    webcrypto.subtle.importKey('jwk', config.masterKey, { name: 'AES-GCM' }, true, [ 'encrypt', 'decrypt' ]).then(
      function (masterKey) {
        runtime.masterKey = masterKey

        webcrypto.subtle.importKey('jwk', config.privateKey, { name: 'ECDSA', namedCurve: 'P-256' }, true, [ 'sign' ]).then(
          function (privateKey) {
            runtime.pair = { privateKey: privateKey }

            run()
          }
        )
      }
    )
  } else {
    webcrypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']).then(
      function (masterKey) {
        runtime.masterKey = masterKey

        webcrypto.subtle.exportKey('raw', runtime.masterKey).then(
          function (exportKey) {
            config.masterKey = exportKey

            webcrypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, [ 'sign', 'verify' ]).then(
              function (pair) {
                runtime.pair = pair

                webcrypto.subtle.exportKey('jwk', runtime.pair.privateKey).then(
                  function (privateKey) {
                    config.privateKey = privateKey

                    webcrypto.subtle.exportKey('jwk', runtime.pair.publicKey).then(
                      function (publicKey) {
                        config.publicKey = publicKey

                        try { create() } catch (err) { oops('create', err) }
                      }
                    )
                  }
                )
              }
            )
          }
        )
      }
    )
  }
})

/*
 *
 * process the command
 *
 */

var run = function () {
  var argv0

  if (argv.length === 0) argv = [ 'get' ]
  argv0 = argv[0]
  argv = argv.slice(1)

  try {
    ({ get: get,
       put: put,
       rm: rm
     }[argv0] || usage)(argv)
  } catch (err) {
    oops(argv0, err)
  }
}

var done = function (command) {
  if (typeof command !== 'string') command = ''
  else command += ' '
  if (verboseP) console.log(command + 'done.')

  process.exit(0)
}

// get persona/session data

var get = function (argv) {
  var path, sessionId, type, userId, uuid

  userId = config.userId
  while (argv.length > 0) {
    if ((argv[0].indexOf('-') !== 0) || (argv.length === 1)) return usage.get()

    if (argv[0] === '-u') userId = argv[1]
    else if (argv[0] === '-s') sessionId = argv[1]
    else if (argv[0] === '-t') type = argv[1]
    else return usage.get()

    argv = argv.slice(2)
  }

  if (userId !== config.userId) {
    uuid = userId.split('-').join('')
    if ((uuid.length !== 32) || (uuid.substr(12, 1) !== '4')) return oops('get', new Error('invalid userId: ' + userId))
  }
  if ((type) && (!sessionId)) sessionId = config.sessionId
  if (sessionId) {
    if (sessionId !== '*') {
      uuid = sessionId.split('-').join('')
      if ((uuid.length !== 32) || (uuid.substr(12, 1) !== '4')) return oops('get', new Error('invalid sessionId: ' + sessionId))
    } else if (type) return usage.get()
  }

  path = '/v1/users/' + userId
  if (sessionId === '*') path += '/sessions'
  else if (sessionId) {
    path += '/sessions/' + sessionId + '/types'
    if (type) path += '/' + type
  }

  roundtrip({ path: path, method: 'GET' }, function (err, response, payload) {
    var ciphertext, count, inner, plaintext

    var more = function () {
      if (--count <= 0) done('get')
    }

    var process = function (state) {
      var inner = state.payload

      plaintext = underscore.omit(inner, 'encryptedData', 'iv')
      if (underscore.keys(plaintext).length !== 0) console.log('Plaintext:  ' + JSON.stringify(plaintext, null, 2))

      ciphertext = underscore.pick(inner, 'encryptedData', 'iv')
      if (underscore.keys(ciphertext).length === 0) return more()

      webcrypto.subtle.decrypt({ name: 'AES-GCM',
                                 iv: hex2ab(ciphertext.iv)
                               }, runtime.masterKey, hex2ab(ciphertext.encryptedData)).then(
        function (plaintext) {
          console.log('Ciphertext: ' + ab2str(plaintext))
          more()
        }
      )
    }

    if (err) oops('get', err)

    count = 1
    inner = payload.payload
    if (sessionId) {
      if (util.isArray(inner)) {
        count = inner.length
        if (count === 0) more()
        inner.forEach(entry => {
          console.log('Session ID: ' + entry.sessionId)
          console.log('Type:       ' + entry.type)
          process(entry)
        })
      } else process(inner)
    } else {
      console.log('Persona ID: ' + inner.userId)
      console.log('Wallets:    ' + JSON.stringify(inner.wallets, null, 2))

      if ((!inner.state) || (!inner.state.payload)) return
      process(inner.state)
    }
  })
}

// put persona/session data

var put = function (argv) {
  var argv0, path, sessionId, type, uuid
  var iv = webcrypto.getRandomValues(new Uint8Array(12))

  while (argv.length > 1) {
    if (argv[0].indexOf('-') !== 0) return usage.put()

    if (argv[0] === '-s') sessionId = argv[1]
    else if (argv[0] === '-t') type = argv[1]
    else return usage.put()

    argv = argv.slice(2)
  }
  argv0 = argv[0] || JSON.stringify({ hello: 'i must be going...' })
  if (argv0.indexOf('-') === 0) return usage.put()

  if (type) {
    if (!sessionId) sessionId = config.sessionId
  } else if (sessionId) return usage.put()

  if (sessionId) {
    uuid = sessionId.split('-').join('')
    if ((uuid.length !== 32) || (uuid.substr(12, 1) !== '4')) return oops('put', new Error('invalid sessionId: ' + sessionId))
  }

  try { JSON.parse(argv0) } catch (err) { return oops('put', err) }

  path = '/v1/users/' + config.userId
  if (sessionId) path += '/sessions/' + sessionId + '/types/' + type

  webcrypto.subtle.encrypt({ name: 'AES-GCM', iv: iv }, runtime.masterKey, str2ab(argv0)).then(
    function (ciphertext) {
      var payload = { encryptedData: ab2hex(ciphertext), iv: ab2hex(iv) }

      try {
        signedtrip({ method: 'PUT', path: path }, payload, function (err, response, body) {
          if (err) oops('put', err)

          done('put')
        })
      } catch (err) {
        oops('signedtrip', err)
      }
    }
  )
}

// delete persona data

var rm = function (argv) {
  var path, sessionId, type
  var payload = ab2hex(webcrypto.getRandomValues(new Uint8Array(12)))

  while (argv.length > 0) {
    if (argv[0].indexOf('-') !== 0) return usage.rm()

    if (argv[0] === '-s') sessionId = argv[1]
    else if (argv[0] === '-t') type = argv[1]
    else return usage.rm()

    argv = argv.slice(2)
  }

  if (type) {
    if (!sessionId) sessionId = config.sessionId
  } else if (sessionId) return usage.rm()

  path = '/v1/users/' + config.userId
  if (sessionId) {
    uuid = sessionId.split('-').join('')
    if ((uuid.length !== 32) || (uuid.substr(12, 1) !== '4')) return oops('put', new Error('invalid sessionId: ' + sessionId))

    path += '/sessions/' + sessionId + '/types/' + type
  }

  signedtrip({ method: 'DELETE', path: path }, payload, function (err, response, body) {
    if (err) oops('delete', err)

    fs.unlink(configFile, function (err) {
      if (err) oops(configFile, err)

      done('rm')
    })
  })
}

/*
 *
 * create a persona in the vault
 *
 * note that the publicKey is not sent as an x/y pair, but instead is a concatenation (the 0x04 prefix indicates this)
 *
 */

var create = function () {
  var payload = { version: 1,
                  publicKey: '04' +
                             new Buffer(config.publicKey.x, 'base64').toString('hex') +
                             new Buffer(config.publicKey.y, 'base64').toString('hex'),
                  xpub: config.xpub
                }

  signedtrip({ method: 'PUT', path: '/v1/users/' + config.userId }, payload, function (err, response, body) {
    if (err) oops('create', err)

    if (response.statusCode !== 201) process.exit(1)

    fs.writeFile(configFile, JSON.stringify(config, null, 2), { encoding: 'utf8', mode: 0o644 }, function (err) {
      if (err) oops(configFile, err)

      run()
    })
  })
}

/*
 *
 * utility functions
 *
 */

/*
 *
 * signed roundtrip to the vault
 *
 * the pattern here is the same for all POSTs/PUTs to the vault:
 *  - generate a nonce
 *  - generate the string to be hashed and then convert to an array buffer
 *  - generate a signature
 *  - fill-in the message
 *  - round-trip to the vault
 *
 * although sending an HTTP body with DELETE is allowed, it may be sent as a query parameter
 * (as some browsers may not be that clueful)
 */

var signedtrip = function (options, payload, callback) {
  var nonce = (new Date().getTime() / 1000.0).toString()
  var combo = JSON.stringify({ userId: config.userId, nonce: nonce, payload: payload })

  webcrypto.subtle.sign({ name: 'ECDSA', namedCurve: 'P-256', hash: { name: 'SHA-256' } },
                        runtime.pair.privateKey, str2ab(combo)).then(
    function (signature) {
      var message = { header: { signature: ab2hex(signature), nonce: nonce }, payload: payload }

      options.headers = { 'Content-Type': 'application/json' }
      if (options.method === 'DELETE') {
        options.path += '?' + querystring.stringify({ message: JSON.stringify(message) })
      } else {
        options.payload = message
      }
      roundtrip(options, callback)
    }
  )
}

// roundtrip to the vault
var roundtrip = function (options, callback) {
  var request
  var client = server.protocol === 'https:' ? https : http

  options = underscore.extend(underscore.pick(server, 'protocol', 'hostname', 'port'), options)

  request = client.request(underscore.omit(options, 'payload'), function (response) {
    var body = ''

    response.on('data', function (chunk) {
      body += chunk.toString()
    }).on('end', function () {
      var payload

      if (verboseP) {
        console.log('>>> HTTP/' + response.httpVersionMajor + '.' + response.httpVersionMinor + ' ' + response.statusCode +
                   ' ' + (response.statusMessage || ''))
      }
      if (Math.floor(response.statusCode / 100) !== 2) return callback(new Error('HTTP response ' + response.statusCode))

      try {
        payload = (response.statusCode !== 204) ? JSON.parse(body) : null
      } catch (err) {
        return callback(err)
      }
      if (verboseP) console.log('>>> ' + JSON.stringify(payload, null, 2).split('\n').join('\n>>> '))

      try {
        callback(null, response, payload)
      } catch (err) {
        oops('callback', err)
      }
    }).setEncoding('utf8')
  }).on('error', function (err) {
    callback(err)
  })
  if (options.payload) request.write(JSON.stringify(options.payload))
  request.end()

  if (!verboseP) return

  console.log('<<< ' + options.method + ' ' + options.path)
  if (options.payload) console.log('<<< ' + JSON.stringify(options.payload, null, 2).split('\n').join('\n<<< '))
}

// courtesy of http://stackoverflow.com/questions/105034/create-guid-uuid-in-javascript#2117523
var uuid = function () {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    var r = webcrypto.getRandomValues(new Uint8Array(1))[0] % 16 | 0
    var v = c === 'x' ? r : (r & 0x3 | 0x8)

    return v.toString(16).toUpperCase()
  })
}

// convert a string to an array of unsigned octets
var str2ab = function (s) {
  var buffer = new Uint8Array(s.length)

  for (var i = 0; i < s.length; i++) buffer[i] = s.charCodeAt(i)
  return buffer
}

// convert an array buffer to a utf8 string
var ab2str = function (ab) {
  var buffer = []
  var view = new Uint8Array(ab)

  for (var i = 0; i < ab.byteLength; i++) buffer[i] = view[i]
  return new Buffer(buffer).toString('utf8')
}

// convert a hex string to an array buffer

var hex2ab = function (s) {
  return new Uint8Array(new Buffer(s, 'hex'))
}

// convert an array buffer to a hex string, not base64 (MTR is old, old-school)
var ab2hex = function (ab) {
  var buffer = []
  var view = new Uint8Array(ab)

  for (var i = 0; i < ab.byteLength; i++) buffer[i] = view[i]
  return new Buffer(buffer).toString('hex')
}

// "hello, i must be going..." (Animal Crackers, 1930)
var oops = function (s, err) {
  console.log(s + ': ' + err.toString())
  console.log(err.stack)
  process.exit(1)
}
