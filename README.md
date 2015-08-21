[![Build Status](https://magnum.travis-ci.com/brave/vault.svg?token=tEKWpRH3WZFkPWrgxB9T)](https://magnum.travis-ci.com/brave/vault)

# Brave Vault

A Personal Data Store for holding high-value user behavior with high privacy.


## Setup

Clone the repo: `git clone git@github.com:brave/vault.git`

Install dependencies with `npm install`.

Install MongoDB: `brew update && brew install mongodb`

Start MongoDB. There are a variety of ways to do this, one option on a mac: `brew tap homebrew/services && brew services start mongodb`

## Running the server

Use `gulp` to run the server in development. This also sets up watchers and will restart the server on a file change.

## Design notes

Intents: https://github.com/brave/vault/wiki/Intents
