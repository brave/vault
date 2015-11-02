# ChangeLog for Brave Vault

## [integration candidate 0.0.3]

* added:
    * /v1/login & /v1/logout for admin/devops using github authentication and team membership
    * /v1/oip/ads/statistics, /v1/oip/ads/categories, and /v1/oip/ads/categories/{category}

* replaced: replace previous OIP driver
    * temporary algorithm for intent mapping
    * /v1/oip/ads/* for devops
    * /v1/ad-manifest/* for admin and devops

* fixed:
    * properly interpret heroku x-forwared-for: header
    * sdebug _finally_ working properly

* moved:
    * `/ad` now `/replacement`
    * `/v1/users/{userId}/ad` now `/v1/users/{userId}/replacement`

* standardjs: now conformant


## [integration candidate 0.0.2](https://github.com/brave/vault/commit/0d286b7484a168a3f0d7958a8155b3414376a1ef)

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

## [integration candidate 0.0.1](https://github.com/brave/vault/commit/e462354cb52a474a1dfb8fe87ab05aee1e8b56df)

* mtr-i-ness: modified `.eslintrc` to allow for comma-first and more horizontal space

* hapi-ness: blipp, boom, joi, plus new module-to-be `brave-hapi`

    * `src/index.js` and `controllers/*.js` re-factored for DRI, etc.

* log-i-ness: new debug module that does structure data in addition to free-form with module-to-be `sdebug`
