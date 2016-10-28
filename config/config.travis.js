if (!process.env.PORT) process.env.PORT = 3000

module.exports =
{ server   : require('url').parse('http://' + '127.0.0.1' + ':' + process.env.PORT)
, database : process.env.MONGODB_URI || 'localhost/test'
}
