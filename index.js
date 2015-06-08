var koa = require('koa');
var app = koa();

app.use(function *(){
  this.body = 'test';
});

var server = app.listen(3000, function() {
    console.log('Koa is listening to http://localhost:3000');
});

app.on('error', function(err){
  log.error('server error', err);
});
