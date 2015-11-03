var boom = require('boom')
var braveHapi = require('../brave-hapi')
var Joi = require('joi')
var underscore = require('underscore')

var v0 = {}

/*
   GET /replacement?braveUserId={userId}
 */

v0.get =
{ handler: function (runtime) {
  return async function (request, reply) {
    var ad, count, image, intents, tag, url, user
    var debug = braveHapi.debug(module, request)
    var height = request.query.height
    var userId = request.query.braveUserId
    var width = request.query.width
    var users = runtime.db.get('users')

    count = await users.update({ userId: userId }, { $inc: { statAdReplaceCount: 1 } }, { upsert: true })
    if (typeof count === 'object') { count = count.nMatched }
    if (count === 0) { return reply(boom.notFound('user entry does not exist', { braveUserId: userId })) }

    user = await users.findOne({ userId: userId }, { intents: true })
    if (user) intents = user.intents
    debug('user intents: ' + JSON.stringify(user.intents))

    ad = (intents) && runtime.oip.adUnitForIntents(intents, width, height)
    if (ad) {
      image = '<a href="' + ad.lp + '" target="_blank"><img src="' + ad.url + '"/></a>'
      tag = ad.name
    } else {
      image = '<img src="https://placeimg.com/' + width + '/' + height + '"/>'
      tag = 'Use Brave'
      debug('default ad returned')
    }

    url = 'data:text/html,<html><body style="width: ' + width +
          'px; height: ' + height +
          'px; padding: 0; margin: 0;">' +
          image +
          '<div style="background-color:blue; color: white; font-weight: bold; position: absolute; top: 0;">' + tag + '</div></body></html>'

    debug('serving ad for query ', request.query, ' with url: ', url)
    reply.redirect(url)
  }
},

description: '(Deprecated) Returns an ad replacement.',
notes: 'This method is deprecated, see the v1 method.',
tags: ['api', 'deprecated'],

validate:
  { query:
    { braveUserId: Joi.string().guid().required(),
      intentHost: Joi.string().hostname().required(),
      tagName: Joi.string().required(),
      width: Joi.number().positive().required(),
      height: Joi.number().positive().required()
    }
  }
}

var v1 = {}

/*
   GET /v1/users/{userId}/replacement?...
 */

v1.get =
{ handler: function (runtime) {
  return async function (request, reply) {
    var ad, tag, count, href, img, intents, result, session, url
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
    if (count === 0) { return reply(boom.notFound('user entry does not exist', { braveUserId: userId })) }

    session = await sessions.findOne({ sessionId: sessionId }, { intents: true })
    if (session) intents = session.intents
    if (!intents) {
      (await sessions.find({ userId: userId }, { intents: true })).forEach(function (s) {
        if (s.intents) intents = underscore.union(intents, s.intents)
      })
    }
    debug('intents: ' + JSON.stringify(intents))
    ad = (intents) && runtime.oip.adUnitForIntents(intents, width, height)

    if (ad) {
      debug('serving ' + ad.category + ': ' + ad.name + ' for ' + JSON.stringify(intents))
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

description: 'Performs an ad replacement',
notes: 'The browser uses this operation to get information on how to perform a replacement.',
tags: ['api'],

validate:
  { query:
    { sessionId: Joi.string().guid().required()
        .description('a UUID v4 value'),
      tagName: Joi.string().required()
        .description('at present, \'iframe\' (for the `&lt;iframe/&gt;` tag)'),
      width: Joi.number().positive().required()
        .description('the width in pixels of the replacement advertisement'),
      height: Joi.number().positive().required()
        .description('the height in pixels of the replacement advertisement')
    },
    params:
    { userId: Joi.string().guid().required() }
  },

  response: {
    schema: Joi.object({
      response: Joi.string()
        .description('a data URL acting as a replacement for the advertisement. The replacement parameter has the form: <br>data:text/html;charset=utf-8,&lt;html&gt;...&lt;a href="https:.../v1/ad-clicks/{adUnitId}"&gt;&lt;img src="..." /&gt;&lt;/a&gt;...&lt;/html&gt; If the user clicks on this `<a/>` tag, then in addition to (automatically) using the `POST /v1/users/{userId}/intents` operation to record the \'click\', the brower also uses the `GET /v1/ad-clicks/{adUnitId}` operation.'),
      status: {
        404: Joi.object({
          boomlet: Joi.string().description('`userId` does not refer to an existing user').required()
        }),
        422: Joi.object({
          boomlet: Joi.string().description('missing parameter').required()
        })
      }
    })
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
    if (!result) { return reply(boom.notFound('', { adUnitId: adUnitId })) }

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

validate:
  { params:
    { adUnitId: Joi.string().hex().required() }
  }
}

module.exports.routes =
[
  braveHapi.routes.async().path('/replacement').config(v0.get),
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
    }
  ])
}
