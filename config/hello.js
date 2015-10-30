module.exports =
{ organization: 'brave',
  world: '/v1/oip/ads/statistics?format=on',
  bye: 'https://brave.com',
  clientId: process.env.GITHUB_CLIENT_ID || '5df62e56d1075b7a6e05',
  clientSecret: process.env.GITHUB_CLIENT_SECRET || 'a79bdf99daee2e383ac7d39648842a234a0d9f63',
  isSecure: process.env.GITHUB_FORCE_HTTPS || false
}
