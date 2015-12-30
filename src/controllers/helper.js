var boom = require('boom')
var createHash = require('crypto').createHash
var Elliptic = require('elliptic').ec
var ec = new Elliptic('p256')
var Joi = require('joi')
// var timestamp = require('monotonic-timestamp')

var exports = {}

exports.verify = async function (debug, user, data) {
  var combo, diff, hash, nonce, r, s, signature
  var header = data.header
  var payload = data.payload

  var u8 = function (a) { return new Uint8Array(a) }

  if (user.version) {
    if (!header) return boom.badRequest('payload is not cryptographically-signed')

    if (user.version !== 1) {
      return boom.badRequest('unknown user entry cryptography version: ' + JSON.stringify(user.version))
    }

    nonce = header.nonce
    if (typeof nonce === 'string') nonce = parseFloat(nonce)
    if (isNaN(nonce)) return boom.badRequest('header.nonce is invalid: ' + JSON.stringify(header.nonce))
    diff = Math.abs(new Date().getTime() - (nonce * 1000.0))
    // NB: 10 minutes is temporary
    if (diff > (6000 * 1000)) return boom.badData('header.nonce is untimely: ' + JSON.stringify(header.nonce))
  } else {
    if (header) return boom.badData('user entry is not cryptographically-enabled')

    return null    // no user entry credentials, no data signature
  }

  combo = JSON.stringify({ userId: user.userId, nonce: header.nonce, payload: payload })
  hash = createHash('sha256').update(new Buffer(combo)).digest()
  signature = new Buffer(header.signature, 'hex')
  r = signature.slice(0, 32)
  s = signature.slice(32)

  try {
    ec.verify(hash, { r: u8(r), s: u8(s) }, u8(new Buffer(user.publicKey, 'hex')))
    return null    // winner!
  } catch (ex) {
    debug('signature error', ex)
    return boom.badData('signature error', ex)
  }
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
