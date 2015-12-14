module.exports =
{ port: process.env.PORT || 3000,
  database: process.env.MONGO_URI || 'localhost/test',
  bitgoPassword: 'YourPassword',
  bitgoAccessToken: 'YourAPIToken',
  login:
  { organization: 'brave',
    world: '/documentation',
    bye: 'https://brave.com',
    clientId: process.env.GITHUB_CLIENT_ID,
    clientSecret: process.env.GITHUB_CLIENT_SECRET,
    isSecure: process.env.GITHUB_FORCE_HTTPS || false
  }
};
