var boom = require('boom')
var braveHapi = require('../brave-hapi')
var bson = require('bson')
var Joi = require('joi')
var underscore = require('underscore')

var v1 = {}

/*
   GET /v1/users/{userId}/replacement?...
 */

v1.get =
{ handler: function (runtime) {
  return async function (request, reply) {
    var ad, tag, count, href, img, result, url
    var debug = braveHapi.debug(module, request)
    var host = request.headers.host
    var protocol = request.url.protocol || 'http'
    var sessionId = request.query.sessionId
    var height = request.query.height
    var width = request.query.width
    var userId = request.params.userId
    var adUnits = runtime.db.get('ad_units')
    var sessions = runtime.db.get('sessions')
    var users = runtime.db.get('users')

    count = await users.update({ userId: userId }, { $inc: { statAdReplaceCount: 1 } }, { upsert: true })
    if (typeof count === 'object') { count = count.nMatched }
    if (count === 0) { return reply(boom.notFound('user entry does not exist: ' + userId)) }

    ad = runtime.oip.adUnitForIntents([], width, height)

    if (ad) {
      debug('serving ' + ad.category + ': ' + ad.name)
      href = ad.lp
      img = '<img src="' + ad.url + '" />'
      tag = ad.name
    } else {
      href = 'https://brave.com/'
      img = '<img src="https://placeimg.com/' + width + '/' + height + '/any" />'
      tag = 'Use Brave'
    }

    result = await adUnits.insert(underscore.extend(request.query, { href: href, img: img }
                                 , underscore.omit(ad || {}, 'lp', 'url')))

    url = 'data:text/html,<html><body style="width: ' + width +
          'px; height: ' + height +
          'px; padding: 0; margin: 0;">' +
          '<a href="' + protocol + '://' + host + '/v1/ad-clicks/' + result._id + '" target="_blank">' + img + '</a>' +
          '<div style="background-color:blue; color: white; font-weight: bold; position: absolute; top: 0;">' +
          tag +
          '</div></body></html>'

    // NB: X-Brave: header is just for debugging
    reply.redirect(url).header('x-brave', protocol + '://' + host + '/v1/ad-clicks/' + result._id)

    try {
      await sessions.update({ sessionId: sessionId },
                            { $currentDate: { timestamp: { $type: 'timestamp' } },
                              $set: { activity: 'ad' },
                              $inc: { statAdReplaceCount: 1 }
                             },
                           { upsert: true })
    } catch (ex) {
      debug('update failed', ex)
    }
  }
},

  description: 'Retrieves an ad replacement',
  notes: 'Returns a replacement ad, via a 301 to <pre>data:text/html;charset=utf-8,&lt;html&gt;...&lt;a href="https:.../v1/ad-clicks/{adUnitId}"&gt;&lt;img src="..." /&gt;&lt;/a&gt;...&lt;/html&gt;</pre>',
  tags: ['api'],

  validate:
    { query:
      { sessionId: Joi.string().guid().required().description('the identify of the session'),
        tagName: Joi.string().required().description('at present, always "IFRAME" (for the &lt;iframe/&gt; tag)'),
        width: Joi.number().positive().required().description('the width in pixels of the replacement ad'),
        height: Joi.number().positive().required().description('the height in pixels of the replacement ad')
      },
      params: { userId: Joi.string().guid().required().description('the identity of the user entry') }
    },

  response: {
/*
    status: {
      301: Joi.object({
        location: Joi.string().required().description('redirection URL')
      }),
      404: Joi.object({
        boomlet: Joi.string().required().description('user entry does not exist')
      })
    }
*/
  }
}

/*
   GET /v1/ad-clicks/{adUnitId}
 */

v1.getClicks =
{ handler: function (runtime) {
  return async function (request, reply) {
    var result
    var debug = braveHapi.debug(module, request)
    var adUnitId = request.params.adUnitId
    var adUnits = runtime.db.get('ad_units')

    result = await adUnits.findOne({ _id: adUnitId })
    if (!result) { return reply(boom.notFound('adUnitId does not refer to a replacement ad: ' + adUnitId)) }

    reply.redirect(result.href)

    try {
      await adUnits.update({ _id: adUnitId }
                           , { $currentDate: { timestamp: { $type: 'timestamp' } } }
                           , { upsert: true })
    } catch (ex) {
      debug('update failed', ex)
    }
  }
},

  description: 'Performs an ad replacement click-through',
  notes: 'Returns a 301 redirect to the site associated with the replacement ad. This endpoint is returned via 301 by the <a href="/documentation#!/v1/v1usersuserIdreplacement_get_15" target="_blank">GET /v1/users/{userId}/replacement</a> operation.',
  tags: ['api'],

  validate:
    { params:
      { adUnitId: Joi.string().hex().description('ad replacement identifier').required() }
    },

  response: {
/*
    status: {
      301: Joi.object({
        location: Joi.string().required().description('redirection URL')
      }),
      404: Joi.object({
        boomlet: Joi.string().required().description('adUnitId does not refer to a replacement ad')
      })
    }
 */
  }
}

module.exports.routes =
[
  braveHapi.routes.async().path('/v1/users/{userId}/replacement').config(v1.get),
  braveHapi.routes.async().path('/v1/ad-clicks/{adUnitId}').config(v1.getClicks)
]

module.exports.initialize = async function (debug, runtime) {
  runtime.db.checkIndices(debug,
  [ { category: runtime.db.get('ad_units'),
      name: 'ad_units',
      property: 'sessionId',
      empty: { sessionId: '' },
      others: [ { sessionId: 1 } ]
    },
    { category: runtime.db.get('sessions'),
      name: 'sessions',
      property: 'sessionId',
      empty: { userId: '', sessionId: '', timestamp: bson.Timestamp.ZERO, intents: [] },
      unique: [ { sessionId: 1 } ],
      others: [ { userId: 0 }, { timestamp: 1 } ]
    }
  ])
}
