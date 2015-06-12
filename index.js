var koa = require('koa');
var route = require('koa-route');
var logger = require('koa-logger');
var app = koa();
var intents = require('./controllers/intents');
var adManifest = require('./controllers/ad-manifest');
var sync = require('./controllers/sync');

app.use(logger());

app.use(route.get('/ad-manifest', adManifest.get));
app.use(route.post('/intents', intents.push));
app.use(route.get('/sync/:userId', sync.get));
app.use(route.post('/sync', sync.push));

app.listen(3000, function() {
    console.log('Koa is listening to http://localhost:3000');
});

app.on('error', function(err){
  console.error('server error', err);
});
