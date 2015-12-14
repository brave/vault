/*
   node example.js [-f config.json] command args ...
 */

var bitgo = require('../node_modules/bitgo')
var fs = require('fs')
var webcrypto = require('./msrcrypto.js')

var usage = function () {
  console.log('usage:\n\t' + process.argv[0] + ' ' + process.argv[1] + ' [ -f file ] command [ args... ]')
  process.exit(0)
}

var argv, configFile
if ((process.argv.length > 2) && (process.argv[2] === '-f')) {
  if (process.argv.length === 3) usage()
  configFile = process.argv[3]
  argv = process.argv.slice(4)
} else {
  configFile = 'config.json'
  argv = process.argv.slice(2)
}

var uuid = function () {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    var r = webcrypto.getRandomValues(new Uint8Array(1))[0] % 16 | 0
    var v = c === 'x' ? r : (r & 0x3 | 0x8)

    return v.toString(16).toUpperCase()
  })
}

var config, keychain
try {
  config = fs.readFileSync(configFile, 'utf8')
} catch (err) {
  keychain = new (bitgo).BitGo({}).keychains().create()

  config = { userId: uuid(), sessionId: uuid(), xpub: keychain.xpub, xprv: keychain.xprv }
}

var runtime = {}

var init = function () {
  if (config.masterKey) {
    webcrypto.subtle.importKey('jwk', config.masterKey, { name: 'AES-GCM' }, true, [ 'encrypt', 'decrypt' ]).then(function (masterKey) {
      runtime.masterKey = masterKey

      webcrypto.subtle.importKey('jwk', config.privateKey, { name: 'ECDSA', namedCurve: 'P-256' }, true, [ 'sign' ]).then(function (privateKey) {
        runtime.pair = { private: privateKey }

        next()
      })
    })
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

              next()
            })
          })
        })
      })
    })
  }
}
init()

var next = function () {
  console.log(' config=' + JSON.stringify(config, null, 2))
  console.log('runtime=' + JSON.stringify(runtime, null, 2))
  console.log('argv=' + argv)
}

/* next step is to see if runtime.pair.publicKey is set, if so:

   - do the PUT
   - on success, write the config file

 */

/* actions:
     - get persona data
     - put persona data
     - create intent
     - list sessions/types
     - update session/type
     - delete session/type
     - delete persona

     - get ad replacement
 */
