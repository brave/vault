var debug = require('debug')('sync');

module.exports.push = function(runtime) {
  return async function (request, reply) {
    var state = request.payload;
    debug('state is:', state);

    if (!state.userId) {
      throw new Error('state must have a userId');
    }

    debug('Registering state: ', state);

    var userState = runtime.db.get('user_states');
    await userState.update({userId: state.userId}, state, {upsert: true});
    reply('OK!');
  };
};

module.exports.get = function(runtime) {
  return async function (request, reply) {
    debug('getting state', request.params.userId);

    var userState = runtime.db.get('user_states');
    var resp = await userState.findOne({userId: request.params.userId});

    resp = resp || {};

    reply(resp);
    debug('body', resp);
  };
};
