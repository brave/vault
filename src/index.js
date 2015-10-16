var Hapi = require('hapi');

var debug = require('debug')('index');
var newrelic = require('newrelic')

var ad = require('./controllers/ad');
var auth = require('./controllers/auth');
var intents = require('./controllers/intents');
var adManifest = require('./controllers/ad-manifest');
var sync = require('./controllers/sync');

var DB = require('./db');
var Sonobi = require('./sonobi').Sonobi;
var Wallet = require('./wallet');

var profile = process.env.NODE_ENV || 'development';
var config = require('./../config/config.' + profile + '.js');

var database = new DB(config);
var runtime = {
  db: database,
  wallet: new Wallet(config),
  sonobi: new Sonobi(config, database)
};

// TODO - do we wait for a pre-fill to complete before starting the server?
runtime.sonobi.prefill();

var server = new Hapi.Server();
server.connection({port: config.port});

server.register([
  require('hapi-async-handler')
], function(error) {
  debug('error', error);
});

server.route([
  {
    method: 'GET',
    path: '/',
    handler: function(request, reply) {
      reply('Welcome to the Vault.');
    }
  },
  {
    method: 'GET',
    path: '/ad-manifest',
    handler: {
      async: adManifest.get(runtime)
    }
  },
  {
    method: 'GET',
    path: '/ad',
    handler: {
      async: ad.get(runtime)
    }
  },
  {
    method: 'POST',
    path: '/auth',
    handler: {
      async: auth.push(runtime)
    }
  },
  {
    method: 'POST',
    path: '/intents',
    handler: {
      async: intents.push(runtime)
    }
  },
  {
    method: 'GET',
    path: '/sync/{userId}',
    handler: {
      async: sync.get(runtime)
    }
  },
  {
    method: 'POST',
    path: '/sync',
    handler: {
      async: sync.push(runtime)
    }
  }
]);

server.on('internalError', function (request, err) {
  debug('internalError', err.data.stack);
});

server.start(function () {
  debug('webserver started on port', config.port);
  // Hook to notify start script.
  if (process.send) {
    process.send('started');
  }
});
