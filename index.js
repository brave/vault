var koa = require('koa');
var route = require('koa-route');
var logger = require('koa-logger');
var app = koa();
var debug = require('debug')('index');
var intents = require('./controllers/intents');
var adManifest = require('./controllers/ad-manifest');
var sync = require('./controllers/sync');
var DB = require('./db');

var config = {
  port: process.env.PORT || 3000,
  database: process.env.MONGO_URI || 'localhost/test'
};

var runtime = {
  db: new DB(config)
};

app.use(logger());

app.use(route.get('/', function * () {
  this.body = 'Welcome to the Vault.';
}));
app.use(route.get('/ad-manifest', adManifest.get(runtime)));
app.use(route.post('/intents', intents.push(runtime)));
app.use(route.get('/sync/:userId', sync.get(runtime)));
app.use(route.post('/sync', sync.push(runtime)));

app.listen(config.port, function() {
  debug('webserver started on port', config.port);
});

app.on('error', function(err){
  debug('server error', err);
});
