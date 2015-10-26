var braveHapi = require('./brave-hapi')
var debug = require('./sdebug')('oip')
var PriorityQ = require('priorityqueuejs')
var underscore = require('underscore')
var wreck = require('wreck')

var OIP = function (config) {
  if (!(this instanceof OIP)) { return new OIP(config) }

  this.config = config
  this.config.oip = underscore.defaults(config.oip || {},
                                       { server: 'http://brave-development.go.sonobi.com/oip.json',
                                         sizes:
                                         { '728x90': {},
                                           '320x50': {},
                                           '300x250': {},
                                           '160x600': {}

                                         },
                                         categories: require('../config/sonobi-codes.js')
                                       })
  this.config.oip.options = underscore.defaults(this.config.oip.options || {},
                                               { refillInterval: 2 * 1000,
                                                 retryInterval: 60 * 1000,
                                                 emptyInterval: 60 * 1000,
                                                 maxFlights: 8,
                                                 lowWater: 3,
                                                 highWater: 7
                                               })

  this.pq = {}
  underscore.keys(this.config.oip.categories).forEach(function (category) {
    this.pq[category] = {}
    underscore.keys(this.config.oip.sizes).forEach(function (size) {
      this.pq[category][size] = { queue: new PriorityQ(braveHapi.comparators.timeStamp),
                                  lowWater: this.config.oip.options.lowWater,
                                  highWater: this.config.oip.options.highWater,
                                  timestamp: 0
                                }
    }.bind(this))
  }.bind(this))

  this.refills = 0
  this.refill()
  // setInterval(this.refill.bind(this), this.config.oip.options.refillInterval);
}

OIP.prototype.summary = function (status, category) {
  debug(status + ' ' + category + ' (' + this.config.oip.categories[category] + ') sizes: ' +
        underscore.keys(this.pq[category]) + '=' +
        underscore.map(underscore.keys(this.pq[category]),
        function (size) { return this.pq[category][size].queue.size() }.bind(this)))
}

OIP.prototype.refill = function () {
  if (this.refills !== 0) { return }

  this.timestamp = new Date().getTime()
  this.reload()
}

OIP.prototype.reload = function () {
  underscore.keys(this.config.oip.categories).forEach(function (category) {
    var payload =
        { elements:
          { 'content_types': [ 'image/gif', 'image/png', 'image/jpeg' ],
            tiles: []
          },
            cat: {},
            lir: { ip: 0, intent: 1, loc: 0, uid: 0 }
        }
    var sizes = []

    if (this.refills >= this.config.oip.options.maxFlights) { return }

    underscore.keys(this.pq[category]).forEach(function (size) {
      var pq = this.pq[category][size]
      var depth = pq.queue.size()
      var tile = []

      if ((depth >= pq.lowWater) || (this.timestamp <= pq.retry)) { return }
      pq.retry = this.timestamp + this.config.oip.options.retryInterval

      sizes.push(size)
      depth = pq.highWater - depth
      while (depth-- > 0) { tile.push({ tsize: size }) }
      payload.elements.tiles.push(tile)
    }.bind(this))
    if (payload.elements.tiles.length === 0) { return }

    payload.cat[category] = ''

    this.refills++
    wreck.post(this.config.oip.server,
               { payload: JSON.stringify(payload),
                 headers: { 'Content-Type': 'application/json' }
               },
        function (err, response, body) {
          var offset, result
          var now = new Date().getTime()

          this.refills--

          try {
            if (err) { throw err }
            result = JSON.parse(body)
          } catch (ex) {
            sizes.forEach(function (size) {
              this.pq[category][size].retry = now + this.config.oip.options.retryInterval
            }.bind(this))

            ex.payload = payload
            if (body) { ex.body = body.toString() }
            return debug('error for OIP category ' + category, ex)
          }

          offset = 0
          sizes.forEach(function (size) {
            var count = 0
            var pq = this.pq[category][size]

            result.elements.tiles[offset].forEach(function (ad) {
              if (ad.url) {
                pq.queue.enq(underscore.extend(ad, { timestamp: now,
                                                     fcap: result.elements.fcap
                                                   }))
                count++
              }

              if (count === 0) {
                this.pq[category][size].retry = now + this.config.oip.options.emptyInterval
              }
// else { console.log(category + ' ' + size + ': ' + require('util').inspect(this.pq[category][size], { depth : null })); }
            }.bind(this))

            offset++
          }.bind(this))
        }.bind(this))
  }.bind(this))

  if (this.refills > 0) { setTimeout(this.reload.bind(this), 500) }
}

module.exports = OIP
