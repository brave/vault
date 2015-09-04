var debug = require('debug')('intents');

module.exports.push = function (runtime) {
  return async function (request, reply) {
    var intent = request.payload;

    if (!intent.type) {
      throw new Error('intent must have a type');
    }

    debug('registering intent', intent);

    var intents = runtime.db.get('intents');
    await intents.insert(intent);

    // Return the user record as a response.
    var users = runtime.db.get('users');
    var user = await users.find({
        userId: intent.userId
      }, {
        userId: true,
        statAdReplaceCount: true
      });
    reply(user[0]);
  };
};
