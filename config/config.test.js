module.exports =
{ port: process.env.PORT || 3000,
  database: process.env.MONGO_URI || 'localhost/test',
  login:
  { organization: 'brave',
    world: '/documentation',
    bye: 'https://brave.com',
    clientId: process.env.GITHUB_CLIENT_ID || '00000000000000000000',
    clientSecret: process.env.GITHUB_CLIENT_SECRET || '0000000000000000000000000000000000000000',
    ironKey: process.env.IRON_KEYPASS,
    isSecure: process.env.GITHUB_FORCE_HTTPS || false
  }
};
