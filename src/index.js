var koa = require('koa');
var route = require('koa-route');
var logger = require('koa-logger');
var app = koa();
var debug = require('debug')('index');
var ad = require('./controllers/ad');
var auth = require('./controllers/auth');
var intents = require('./controllers/intents');
var adManifest = require('./controllers/ad-manifest');
var sync = require('./controllers/sync');

var DB = require('./db');
var Wallet = require('./wallet');

var profile = process.env.NODE_ENV || 'development';
var config = require('./../config/config.' + profile + '.js');

var runtime = {
  db: new DB(config),
  wallet: new Wallet(config)
};

app.use(logger());

app.use(route.get('/', function * () {
  this.body = 'Welcome to the Vault.';
}));
app.use(route.get('/ad-manifest', adManifest.get(runtime)));
app.use(route.get('/ad', ad.get(runtime)));
app.use(route.post('/auth', auth.push(runtime)));
app.use(route.post('/intents', intents.push(runtime)));
app.use(route.get('/sync/:userId', sync.get(runtime)));
app.use(route.post('/sync', sync.push(runtime)));

app.listen(config.port, function() {
  debug('webserver started on port', config.port);
  // Hook to notify start script.
  if (process.send) {
    process.send('started');
  }
});

app.on('error', function(err){
  debug('server error', err);
});
