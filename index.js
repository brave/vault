var koa = require('koa');
var route = require('koa-route');
var logger = require('koa-logger');
var app = koa();
var debug = require('debug')('index')
var intents = require('./controllers/intents');
var adManifest = require('./controllers/ad-manifest');
var sync = require('./controllers/sync');

app.use(logger());

app.use(route.get('/', function * () {
	this.body = 'Welcome to the Vault.';
}));
app.use(route.get('/ad-manifest', adManifest.get));
app.use(route.post('/intents', intents.push));
app.use(route.get('/sync/:userId', sync.get));
app.use(route.post('/sync', sync.push));

app.listen(3000, function() {
  debug('webserver started at http://localhost:3000');
});

app.on('error', function(err){
  debug('server error', err);
});
