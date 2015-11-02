var debug = new (require('./sdebug'))('oip')
var natural = require('natural')
var PriorityQ = require('priorityqueuejs')
var Trie = natural.Trie
var underscore = require('underscore')
var util = require('util')
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
                                                 lowWater: 5,
                                                 highWater: 15
                                               })

  this.pqs = {}
  this.tokenizer = new natural.WordTokenizer()
  underscore.keys(this.config.oip.categories).forEach(function (category) {
    var trie = new Trie()

    trie.addStrings(this.tokenizer.tokenize(this.config.oip.categories[category]))
    this.pqs[category] = { category: category, errors: 0, sizes: {}, trie: trie, intents: trie.keysWithPrefix('') }
    underscore.keys(this.config.oip.sizes).forEach(function (size) {
      this.pqs[category].sizes[size] = { queue: new PriorityQ(pqComparator),
                                        lowWater: this.config.oip.options.lowWater,
                                        highWater: this.config.oip.options.highWater,
                                        empties: 0,
                                        impressions: 0,
                                        retry: 0
                                       }
    }.bind(this))
  }.bind(this))

  this.refills = 0
  this.refill()
  setInterval(this.refill.bind(this), this.config.oip.options.refillInterval)
}

var pqComparator = function (a, b) {
  var diff = a.expires - b.expires

  return ((diff !== 0) ? diff : (b.impressions - a.impressions))
}
var isNum = function (s) {
  return (/^(\-|\+)?([0-9]+|Infinity)$/.test(s))
}

OIP.prototype.refill = function () {
  if (this.refills !== 0) { return }

  debug('refill')
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

    underscore.keys(this.pqs[category].sizes).forEach(function (size) {
      var pq = this.pqs[category].sizes[size]
      var depth = pq.impressions
      var tile = []

      this.trim(pq)
      if ((depth >= pq.lowWater) || (this.timestamp <= pq.retry)) { return }
      pq.retry = this.timestamp + this.config.oip.options.retryInterval

      sizes.push(size)
      for (depth = pq.highWater - depth; depth > 0; depth--) { tile.push({ tsize: size }) }
      payload.elements.tiles.push(tile)
    }.bind(this))
    if (payload.elements.tiles.length === 0) { return }

    payload.cat[category] = 24 * 60 * 60

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
            this.pqs[category].errors++
            sizes.forEach(function (size) {
              this.pqs[category].sizes[size].retry = now + this.config.oip.options.retryInterval
            }.bind(this))

            if ((body) && (body.length !== 0)) {
              ex.payload = payload
              if (body) { ex.body = body.toString() }
            }
            return debug('error for OIP category ' + category, ex)
          }

          offset = 0
          sizes.forEach(function (size) {
            var parts
            var count = 0
            var frequency = util.isArray(result.elements.fcap) ? (result.elements.fcap[offset] || result.elements.fcap[0])
                                : { intent_type: '', intent_data: '', time_frame: 0, impression_limit: 0 }
            var pq = this.pqs[category].sizes[size]

            if (!util.isArray(result.elements.tiles[offset])) return

            parts = frequency.time_frame.toString().split(' ')
            if (parts.length === 2) {
              frequency.time_frame = parseInt(parts[0], 10) * { week: 7 * 24 * 60 * 60,
                                                                weeks: 7 * 24 * 60 * 60,
                                                                day: 24 * 60 * 60,
                                                                days: 24 * 60 * 60,
                                                                hour: 60 * 60,
                                                                hours: 60 * 60,
                                                                minute: 60,
                                                                minutes: 60,
                                                                second: 1,
                                                                seconds: 1 }[parts[1]]
            }
            if (isNum(frequency.time_frame)) {
              frequency.time_frame = parseInt(frequency.time_frame, 10)
            } else {
              debug('unknown time_frame in ' + JSON.stringify(frequency))
              frequency.time_frame = 0
            }
            if (frequency.time_frame <= 0) frequency.time_frame = 24 * 60 * 60

            if (isNum(frequency.impression_limit)) {
              frequency.impression_limit = parseInt(frequency.impression_limit, 10)
            } else {
              debug('unknown impression_limit in ' + JSON.stringify(frequency))
              frequency.impression_limit = 0
            }
            if (frequency.impression_limit <= 0) frequency.impression_limit = 1

            result.elements.tiles[offset].forEach(function (ad) {
              if (ad.url) {
                pq.queue.enq(underscore.extend(ad, { expires: now + (frequency.time_frame * 1000),
                                                     impressions: frequency.impression_limit
                                                   }))
                pq.impressions += frequency.impression_limit
                count++
              }

              if (count === 0) {
                this.pqs[category].sizes[size].empties++
                this.pqs[category].sizes[size].retry = now + this.config.oip.options.emptyInterval
              } else {
                this.pqs[category].sizes[size].empties = 0
              }
            }.bind(this))

            offset++
          }.bind(this))
          if (!util.isArray(result.elements.fcap)) return debug('frequency caps not an array')

          result.elements.fcap.forEach(function (frequency) {
            if (frequency.intent_data) {
              this.pqs[category].trie.addStrings(this.tokenizer.tokenize(frequency.intent_data))
              this.pqs[category].intents = this.pqs[category].trie.keysWithPrefix('')
            }
          }.bind(this))
        }.bind(this))
  }.bind(this))

  if (this.refills > 0) { setTimeout(this.reload.bind(this), 500) }
}

OIP.prototype.trim = function (pq) {
  var ad
  var now = new Date().getTime()

  while (!pq.queue.isEmpty()) {
    if (pq.queue.peek().expires >= now) return

    ad = pq.deq()
    pq.impressions -= ad.impressions
  }
}

OIP.prototype.adUnitForIntents = function (intents, width, height) {
  var ad, pq, result, suffix
  var score = -1
  var size = width + 'x' + height

  underscore.shuffle(underscore.keys(this.config.oip.categories)).forEach(function (category) {
    var ilength, pqs

    pqs = this.pqs[category]
    pq = pqs.sizes[size]
    if (!pq) return

    this.trim(pq)
    if (pq.queue.isEmpty()) return

    ilength = underscore.intersection(intents, pqs.intents)
    if (ilength <= score) return

    result = pqs
    score = ilength
    suffix = { category: category, name: this.config.oip.categories[category] }
  }.bind(this))

  if (!result) return debug('nothing matching intents of ' + JSON.stringify(intents))

  pq = result.sizes[size]
  pq.impressions--
  ad = pq.queue.deq()
  if ((ad.impressions -= 1) > 0) pq.queue.enq(ad)
  debug('mapping intents of ' + intents.length + ' to ' + this.config.oip.categories[result.category])

  return underscore.extend({}, ad, suffix)
}

OIP.prototype.categories = function (formatP) {
  var now = new Date().getTime()
  var result = {}

  underscore.keys(this.config.oip.categories).forEach(function (category) {
    var pqs = this.pqs[category]

    result[category] = { name: this.config.oip.categories[category],
                         errors: pqs.errors,
                         intents: pqs.intents,
                         sizes: {}
                       }

    underscore.keys(pqs.sizes).forEach(function (size) {
      var datum, earliest, latest
      var pq = pqs.sizes[size]
      var retry = Math.max(pq.retry - now, 0)

      this.trim(pq)
      datum = { empties: pq.empties,
                queue: pq.queue.size(),
                retryIn: formatP ? retry / 1000 : pq.retry,
                impressions: pq.impressions
              }
      earliest = Number.MAX_SAFE_INTEGER
      latest = 0
      pq.queue.forEach(function (element) {
        if (earliest > element.expires) earliest = element.expires
        if (latest < element.expires) latest = element.expires
      })
      if (latest === 0) earliest = 0
      result[category].sizes[size] = underscore.extend(datum,
                                                       { earliest: formatP ? Math.max(earliest - now, 0) / 1000 : earliest,
                                                         latest: formatP ? Math.max(latest - now, 0) / 1000 : latest
                                                       })
    }.bind(this))
  }.bind(this))

  return result
}

var bootTime = new Date().getTime()

OIP.prototype.statistics = function (formatP) {
  var result = { uptime: formatP ? (new Date().getTime() - bootTime) / 1000 : bootTime,
                 categories: { active: 0, total: underscore.keys(this.config.oip.categories).length },
                 errors: 0,
                 options: this.config.oip.options,
                 sizes: {}
               }

  underscore.keys(this.config.oip.categories).forEach(function (category) {
    var activeP = 0
    var pqs = this.pqs[category]

    result.errors += pqs.errors
    underscore.keys(pqs.sizes).forEach(function (size) {
      var pq = pqs.sizes[size]

      if (pq.impressions > 0) activeP = 1
      if (!result.sizes[size]) result.sizes[size] = { empties: 0, impressions: 0, queue: 0 }
      result.sizes[size].empties += pq.empties
      result.sizes[size].impressions += pq.impressions
      result.sizes[size].queue += pq.queue.size()
    })

    if (activeP) result.categories.active++
  }.bind(this))

  return result
}

module.exports = OIP
