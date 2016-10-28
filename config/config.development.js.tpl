if (!process.env.PORT) process.env.PORT = 3000

module.exports =
{ server                : require('url').parse('http://' + '127.0.0.1' + ':' + process.env.PORT)
, database              :
  { mongo               : process.env.MONGODB_URI          || 'localhost/test' }
, slack                 :
  { webhook             : process.env.SLACK_WEBHOOK
  , channel             : process.env.SLACK_CHANNEL
  , icon_url            : process.env.SLACK_ICON_URL
  }
, login                 :
  { organization        : ''
  , world               : '/documentation'
  , bye                 : 'https://example.com'
  , clientId            : process.env.GITHUB_CLIENT_ID
  , clientSecret        : process.env.GITHUB_CLIENT_SECRET
  , ironKey             : process.env.IRON_KEYPASS
  , isSecure            : process.env.GITHUB_FORCE_HTTPS   || false
  }
}
