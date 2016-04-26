[![Build Status](https://travis-ci.org/brave/vault.svg)](https://travis-ci.org/brave/vault)

# Brave Vault
Brave personal data store vault.

<img src='documentation/ecosystem.png' />

# Initialization
Take a look at the files in the `config/` directory.
When the server starts,
it will look file a file called `config/config.{PROFILE}.js` where `{PROFILE}` is `$NODE_ENV` (defaulting to `"development"`).

Authentication is achieved via a GitHub [OAuth application](https://github.com/settings/developers).
Create a developer application with an authorization callback of the form `https://{DOMAIN:PORT}/v1/login` and update the
`login.clientId` and `login.clientSecret` properties.

Authorization is achieved by verifying that the user is a member of a GitHub organization, i.e.,
`https://github.com/orgs/{ORGANIZATION}/teams`.
Set the `login.organization` property to the name of the organization.

Now start the server with `npm start` and `https://{DOMAIN:PORT}/v1/login` which will start the authentication/authorization
process.
On success,
you will be redirected to `https://{DOMAIN:PORT}/documentation`.

# Setup
Clone the repo: `git clone git@github.com:brave/vault.git`

Install dependencies with `npm install`

Install MongoDB: `brew update && brew install mongodb`

Start MongoDB. There are a variety of ways to do this, one option on a mac: `brew tap homebrew/services && brew services start mongodb`

## StandardJS
For linting we use [StandardJS](https://github.com/feross/standard). It's recommended that you install the necessary IDE plugin. Since this repo uses ES7 features, you'll need a global install of both the standard and babel-eslint packages.

## Configuration
For staging or production environments configuration variables are stored as environment preferences. See config/config.production.js for a list of these variables.

For local development you can copy config/config.development.js.tpl to config/config.development.js and define the local config variables.

## Running the server
Use `gulp` to run the server in development. This also sets up watchers and will restart the server on a file change.

## Theory of Operation
All operations are available via only HTTPS on public-facing systems.
At a minimum,
all requests are logged with method, path, `Host` and `User-Agent` headers, client IP address,
and `sessionId` parameter (if present);
and all responses are logged with code and diagnostic(if any)
All HTTP content is `application/json`.
Commonly used data types are:

| data type     | syntax                                                                                                      |
| -------------:|:----------------------------------------------------------------------------------------------------------- |
| `diagnostic`  | localized string intended for logging and human consumption                                                 |
| `sessionId`   | [UUID v4](https://en.wikipedia.org/wiki/Universally_unique_identifier#Version_4_.28random.29) string        |
| `timestamp`   | opaque string identifying a unique instance of time                                                         |
| `userId`      | [UUID v4](https://en.wikipedia.org/wiki/Universally_unique_identifier#Version_4_.28random.29) string        |

Errors are "boomlets", e.g.,

        {
          "statusCode": 420,
          "error": "Enhance Your Calm",
          "message": "Your repeated violations of the Verbal Morality Statute ..."
        }

Complete <a href='http://vault-staging.brave.com/documentation'>documentation</a>.
