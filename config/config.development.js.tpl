module.exports =
{ port: process.env.PORT || 3000,
  database: process.env.MONGO_URI || 'localhost/test',
  bitgoPassword: process.env.BITGO_PASSWORD || '...',
  bitgoAccessToken: process.env.BITGO_TOKEN || '...',
  login:
  { organization: 'brave',
    world: '/documentation',
    bye: 'https://brave.com',
    clientId: process.env.GITHUB_CLIENT_ID,
    clientSecret: process.env.GITHUB_CLIENT_SECRET,
    isSecure: process.env.GITHUB_FORCE_HTTPS || false
  }
};
