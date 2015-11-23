var boom = require('boom')
var crypto = require('crypto')
var ecdsa = require('eccrypto')

var exports = {}

exports.userId2stats = async function (runtime, userId) {
  var user
  var users = runtime.db.get('users')

  user = await users.findOne({ userId: userId }, { statAdReplaceCount: true })

  return { replacements: user ? user.statAdReplaceCount : 0 }
}

exports.sessionId2stats = async function (runtime, userId, sessionId) {
  var session
  var sessions = runtime.db.get('sessions')

  session = await sessions.findOne({ userId: userId, sessionId: sessionId }, { statAdReplaceCount: true })

  return { replacements: session ? session.statAdReplaceCount : 0 }
}

/*
var to_hex = function (bs) {
  var i
  var encoded = []

  for (i = 0; i < bs.length; i++) {
    encoded.push('0123456789abcdef'[(bs[i] >> 4) & 15])
    encoded.push('0123456789abcdef'[bs[i] & 15])
  }
  return encoded.join('')
}
 */

var from_hex = function (s) {
  var i, result

  if (!s) s = ''
  result = new Uint8Array(s.length / 2)
  for (i = 0; i < s.length / 2; i++) result[i] = parseInt(s.substr(i * 2, 2), 16)

  return result
}

exports.verify = async function (debug, user, data) {
  var envelope = data.envelope
  var payload = JSON.stringify(data.payload || data.intent)

  if (user.envelope) {
    if (!envelope) return boom.badRequest('payload is not cryptographically-signed')

    if (user.envelope.version !== 1) {
      return boom.badRequest('unknown user entry cryptography version: ' + JSON.stringify(user.envelope.version))
    }
    if (typeof envelope.nonce !== 'string') {
      return boom.badRequest('envelope.nonce is invalid: ' + JSON.stringify(envelope.nonce))
    }
  } else {
    if (envelope) return boom.badData('user entry is not cryptographically-enabled')

    return null    // no user entry credentials, no data signature
  }

  try {
    await ecdsa.verify(from_hex(user.envelope.publicKey),
                       crypto.createHash('sha256').update(user.userId + ':' + envelope.nonce + ':' + payload).digest(),
                       from_hex(envelope.signature))

    return null    // winner!
  } catch (ex) {
    debug('signature error', ex)
    return boom.badData('signature error', ex)
  }
}

module.exports = exports
