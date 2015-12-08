var boom = require('boom')
var crypto = require('crypto')
var ecdsa = require('eccrypto')
var Joi = require('joi')
// var timestamp = require('monolithic-timestamp')

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
  var diff, nonce
  var envelope = data.envelope
  var payload = JSON.stringify(data.payload || data.intent)

  if (user.envelope) {
    if (!envelope) return boom.badRequest('payload is not cryptographically-signed')

    if (user.envelope.version !== 1) {
      return boom.badRequest('unknown user entry cryptography version: ' + JSON.stringify(user.envelope.version))
    }

    nonce = envelope.nonce
    if (typeof nonce === 'string') nonce = parseFloat(nonce)
    if (isNaN(nonce)) return boom.badRequest('envelope.nonce is invalid: ' + JSON.stringify(envelope.nonce))
    diff = Math.abs(new Date().getTime() - (nonce * 1000.0))
    if (diff > 15) return boom.badData('envelope.nonce is untimely: ' + JSON.stringify(envelope.nonce))
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

exports.add_nonce = function (payload) {
  return { envelope: { nonce: (new Date().getTime() / 1000.0).toString() }, payload: payload }
}

exports.add_header_schema = function (payload) {
  return Joi.object({
    header: Joi.object({
      signature: Joi.string().required().description('a digital signature calculated over userId:nonce:JSON.stringify(payload)'),
      nonce: Joi.string().required().description('a time-based, monotonically-increasing value')
    }).required(),
    payload: payload.required()
  })
}

exports.add_nonce_data = function (payload) {
  return { payload: payload, trailer: { nonce: (new Date().getTime() / 1000.0).toString() } }
}

exports.add_nonce_schema = function (payload) {
  return Joi.object({
    payload: payload.required(),
    trailer: Joi.object({
      nonce: Joi.string().required().description('a time-based, monotonically-increasing value')
    }).required()
  })
}

module.exports = exports
