module.exports =
{ port           : process.env.PORT
, database       :
  { mongo        : process.env.MONGODB_URI }
, login:
  { organization : 'brave'
  , world        : '/documentation'
  , bye          : 'https://brave.com'
  , clientId     : process.env.GITHUB_CLIENT_ID
  , clientSecret : process.env.GITHUB_CLIENT_SECRET
  , ironKey      : process.env.IRON_KEYPASS
  , isSecure     : true
  }
}
