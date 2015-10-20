# ChangeLog for Brave Vault

## [0.0.1]

* deprecated: `POST /auth` by `PUT /v1/users/{userId}`
    * `{ userId: '...' }` no longer passed as the body, now part of the path

* added: `DELETE /v1/users/{userId}/sessions/{sessionId}`
    * `sessionId` (a UUIDv4 string created by the browser) used for recording user intentions and replacing advertisements

* deprecated: `POST /intents` by `POST /v1/users/{userId}/intents`
    * `sessionId`, `type`, `timestamp`, and opaque JSON obect `payload` required,
      as specified in [explicitly defined](https://github.com/brave/vault/wiki/Intents)
    * the most "interesting" value for type is `"browser.site.visit"`

* deprecated: `GET /ad` by `GET /v1/users/{userId}/ad?...` and `GET /v1/ad-clicks/{adUnitId}`
    * `{ braveUserId: '...' }` no longer passed as the body, now part of the path
    * 301 response for `GET /v1/users/{userId}/ad` returns embedded `a.href` pointing to `GET /v1/ad-clicks/{adUnitId}`
    * accordingly, browser automatically and unambiguously informs the vault about the click-through

* deprecated: `GET /sync/{userId}` and `POST /sync` by `GET /v1/users/{userId}/appState` and `PUT /v1/users/{userId}/appState`
    * supports _advisory locking_ using "last timestamp" strategy
