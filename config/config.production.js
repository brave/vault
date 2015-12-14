module.exports =
{ port: process.env.PORT,
  database: process.env.MONGO_URI,
  bitgoPassword: process.env.BITGO_PASSWORD,
  bitgoAccessToken: process.env.BITGO_TOKEN,
  login:
  { organization: 'brave',
    world: '/documentation',
    bye: 'https://brave.com',
    clientId: process.env.GITHUB_CLIENT_ID,
    clientSecret: process.env.GITHUB_CLIENT_SECRET,
    isSecure: true
  }
};
