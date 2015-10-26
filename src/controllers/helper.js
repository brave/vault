var exports = {}

exports.userId2stats = async function (runtime, userId) {
  var user
  var users = runtime.db.get('users')

  user = await users.findOne({ userId: userId }, { statAdReplaceCount: true })
  if (!user) { return undefined }

  return { replacements: user.statAdReplaceCount }
}

exports.sessionId2stats = async function (runtime, userId, sessionId) {
  var session
  var sessions = runtime.db.get('sessions')

  session = await sessions.findOne({ userId: userId, sessionId: sessionId }, { statAdReplaceCount: true })
  if (!session) { return undefined }

  return { replacements: session.statAdReplaceCount }
}

module.exports = exports
