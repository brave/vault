/*
   node example.js [-f config.json] [-s server] command args ...
 */

var bitgo = require('../node_modules/bitgo')
var fs = require('fs')
var http = require('http')
var https = require('https')
var underscore = require('../node_modules/underscore')
var url = require('url')
var webcrypto = require('./msrcrypto.js')

/*
 *
 * parse the command arguments
 *
 */

var usage = function () {
  console.log('usage:\n\t' + process.argv[0] + ' ' + process.argv[1] + ' [ -f file ] command [ args... ]')
  process.exit(1)
}

var argv = process.argv.slice(2)
var configFile = process.env.CONFIGFILE || 'config.json'
var server = process.env.SERVER || 'https://vault-staging.brave.com'
var verboseP = process.env.VERBOSE || false

server = 'http://127.0.0.1:3000'
verboseP = true

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
 * if a configuration file already existed, then next() is called to process the command; otherwise, create() is called to
 * create the persona and then process the command
 */

var config
var runtime = {}

fs.readFile(configFile, { encoding: 'utf8' }, function (err, data) {
  var keychain

  if (err) {
    keychain = new (bitgo).BitGo({}).keychains().create()

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
            runtime.pair = { private: privateKey }

            next()
          }
        )
      }
    )
  } else {
    webcrypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']).then(function (masterKey) {
      runtime.masterKey = masterKey

      webcrypto.subtle.exportKey('raw', runtime.masterKey).then(function (exportKey) {
        config.masterKey = exportKey

        webcrypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, [ 'sign', 'verify' ]).then(function (pair) {
          runtime.pair = pair

          webcrypto.subtle.exportKey('jwk', runtime.pair.privateKey).then(function (privateKey) {
            config.privateKey = privateKey

            webcrypto.subtle.exportKey('jwk', runtime.pair.publicKey).then(function (publicKey) {
              config.publicKey = publicKey

              try { create() } catch (ex) { oops('create', ex) }
            })
          })
        })
      })
    })
  }
})

/*
 *
 * process the command
 *
 *  - get
 *
 *  - put persona data
 *  - create intent
 *  - list sessions/types
 *  - update session/type
 *  - delete session/type
 *  - delete persona
 *  - get ad replacement
 *  - get site ad-info
 */

var next = function () {
  console.log('argv=' + JSON.stringify(argv))

  if (argv.length === 0) argv = [ 'get' ]
  switch (argv[0]) {
    case 'get':
      get()
      break

    default:
      usage()
  }
}

var get = function () {
  roundtrip({ path: '/v1/users/' + config.userId, method: 'GET' }, function (err, response, payload) {
    if (err) oops('get', err)

// ...
  })
}

/*
 *
 * create a persona in the vault
 *
 * the pattern here is the same for all POSTs/PUTs to the vault:
 *  - generate a nonce and build the message payload
 *  - generate the string to be hashed and then convert to an array buffer
 *  - generate a signature
 *  - fill-in the message header
 *  - round-trip to the vault
 *
 * note that the publicKey is not sent as an x/y pair, but a concatenation (the 0x04 prefix indicates this)
 *
 */

var create = function () {
  var combo
  var nonce = (new Date().getTime() / 1000.0).toString()
  var message = { header: {},
                  payload:
                  { version: 1,
                    publicKey: '04' +
                               new Buffer(config.publicKey.x, 'base64').toString('hex') +
                               new Buffer(config.publicKey.y, 'base64').toString('hex'),
                    xpub: config.xpub
                  }
                }

  combo = JSON.stringify({ userId: config.userId, nonce: nonce, payload: message.payload })
  webcrypto.subtle.sign({ name: 'ECDSA', namedCurve: 'P-256', hash: { name: 'SHA-256' } },
                            runtime.pair.privateKey, s2ab(combo)).then(
    function (signature) {
      message.header = { signature: to_hex(ab2b(signature)), nonce: nonce }
      console.log(JSON.stringify(message, null, 2))

      roundtrip({ path: '/v1/users/' + config.userId,
                  method: 'PUT',
                  headers: { 'Content-Type': 'application/json' }
                }, function (err, response, body) {
        if (err) oops('create', err)

        if (response.statusCode !== 201) process.exit(1)

        fs.writeFile(configFile, JSON.stringify(config, null, 2), { encoding: 'utf8', mode: 0o644 }, function (err) {
          if (err) oops(configFile, err)

          next()
        })
      })
    }
  )
}

/*
 *
 * utility functions
 *
 */

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
        try {
          payload = JSON.stringify(JSON.parse(body), null, 2)
        } catch (ex) {
          payload = body.toString()
        }
        console.log('>>> ' + payload.split('\n').join('\n>>> '))
      }

      callback(null, response, payload)
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
var s2ab = function (s) {
  var buffer = new Uint8Array(s.length)

  for (var i = 0; i < s.length; i++) buffer[i] = s.charCodeAt(i)
  return buffer
}

// convert an array buffer to a array
var ab2b = function (ab) {
  var buffer = []
  var view = new Uint8Array(ab)

  for (var i = 0; i < ab.byteLength; i++) buffer[i] = view[i]
  return buffer
}

// the vault likes things in hex, not base64 (MTR is old, old-school)
var to_hex = function (bs) {
  var encoded = []

  for (var i = 0; i < bs.length; i++) {
    encoded.push('0123456789abcdef'[(bs[i] >> 4) & 15])
    encoded.push('0123456789abcdef'[bs[i] & 15])
  }
  return encoded.join('')
}

// "hello, i must be going..." (Animal Crackers, 1930)
var oops = function (s, err) {
  console.log(s + ': ' + err.toString())
  console.log(err.stack)
  process.exit(1)
}
