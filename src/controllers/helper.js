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

module.exports = exports
