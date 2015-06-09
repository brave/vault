var koa = require('koa');
var route = require('koa-route');
var logger = require('koa-logger');
var app = koa();
var intents = require('./controllers/intents');
var adManifest = require('./controllers/ad-manifest');

app.use(logger());

app.use(route.get('/ad-manifest', adManifest.get));
app.use(route.post('/intents', intents.push));

app.listen(3000, function() {
    console.log('Koa is listening to http://localhost:3000');
});

app.on('error', function(err){
  console.error('server error', err);
});
