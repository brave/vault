# Sharing Application State using the Vault

## Overview

When a client starts,
it persists a client-generated persona-identifier (a V4 UUID)
which is used to talk to the Vault server.
It also generates a session-identifier (another V4 UUID),
that is used until the next time the client starts.

There are small number of interactions between the client and the Vault,
each requiring the persona-identifier and (sometimes) session-identifier.

One such interaction is the ability of a client to upload application state on behalf of a persona to the Vault.
The Vault treats the application state as an opaque JSON object;
accordingly,
the clients are responsible for determining the syntax, semantics, and encoding of the shared application state.

A persona-identifier may be shared between clients all acting on behalf of the same persona.
This memo describes the mechanism for clients to acquire the same persona-identifier and share application state.

### Version one goals
* no linkages to any identities other than the persona-identifier assigned by one of the browsers;

* minimal user complexity;

* ability to recover shared application state after any (or all) devices are reset; and,

* ability to do message-integrity when saving shared application state or uploading client "intents"

### Caveats
* _awaiting security review_

* _awaiting UX review_ (specific text strings are placeholders only)

* _cryptographic functions are used as examples, NaCl may be the final choice_

## Approach

### Initialization
As usual:

* Prior to the first communication with the Vault,
a client generates a persona-identifier,
and this is persisted.

* Whenever the client starts,
it generates a session-identifier,
that is not persisted.

In addition,
upon generation of the persona-identifier:

* The client also generates a key-pair (`publicKey` and `privateKey`),
and a "strong plaintext" `passphrase`, that is persisted in the client.

* The client performs the `PUT /v1/users/{userId}`
[operation](https://vault.brave.com/documentation#!/v1/v1usersuserId_put_10) with this payload:

        { version             : 1
        , publicKey           : Buffer(publicKey).toString('base64')
        }

* Upon success,
the client performs the `PUT /users/{userId}/appState`
[operation](https://vault.brave.com/documentation#!/v1/v1usersuserIdappState_put_11) with this payload:

        { payload             :
          { version           : 1
          , header            :
            { publicKey       : Buffer(publicKey).toString('base64')
            , encryptedPRVK   : crypto.createCipher('...', passphrase).update(privateKey).final('base64')
            }
          }
        }

Immediately prior to the first time that the client wishes to store shared application state,
the client displays:

        Persona-ID: {userId}
        Passphrase: {passphrase}

along with the QR encoding for:

        brave://vault/uuid/{userId}?p={passphrase}

For example, `brave://vault/uuid/160395dd-bb88-4170-93ff-4698c7c1f097?p=RGCXHmk9LQnigidA2QrHJgsyckzjMj` encodes as:

<img src='data:image/jpeg;base64,iVBORw0KGgoAAAANSUhEUgAAAcIAAAHCAQMAAABG1lsGAAAABlBMVEX///8AAABVwtN+AAACdklEQVQIme2ay62DQAxFLVEAJdE6JaWASH7g3xiGRNm/cxcoMD5eWba5RAQhhBBCCIlo6H38Xt+i+3rcjEscZNQOCTmTfuPQEbW9LNsZL4vGZX1fgiEhr6RXWp0Zfjw6Lme2JC0bJORXMs6yjR11uKgX4w4J+RNpUTnxKocFQUJ+JcfZUW5xMVmin+Yn5P8mQ6N5PV0yChJyJpu246jfr59DISGHoqqsvmx10tHL5LpTLQoJ+UD2xzkKPeVeye3XvTYhIUvrcAAiUQxFsWLU2KS2+zYOCenKeGmugIhkL/PbbGOQkE+kTbyYgtLJ8xINzV0BhYR8JHfH5eosqbexsVgNawAS8kZG37JhF/Xlz2KnGiU41S0kpMm/g0ic5dPsW6O1hVkJCXknxxQcZDSv1zVOp7qFhHSt9fb2ikTjVzcEWm1CQnZtVlU14nx18uobrkCfkZCQT/uQlp90/Ubb+5sskJBPpFea+4/pCrQ6rBWrHUBC3jtYhb5uz6LcAp8ECWkKU0nDk/T4U/H1rV71fFpCQk6kQz2qHO6agpZoFiSkadjXbWFSr7Q0Jrfas3ZIyAdSK/5VBlJ9o7UQSxkFCgk5kRH1zl6mqtnVRHIRz2LcISEfSOkDMFwBt5LidoYgIa9kWgP+HjecyGxjo6vdqw8S8iLHa5MKKD+VfIAgISWLKwovGpq/1p1qxuTscENCSlXVWtZA+6Vtf/owBSEhs+bSRRLrYHvtVFs6Szq7ApCQd/J8bCF+svkAXHSsWJCQ38mxkhve/r22hkkACflI5lm4k/7hrbZxTd+pBUNCXshQdrDyAjxb5C2nABJyIhFCCCGE/q/+AAz4nwRJw2S4AAAAAElFTkSuQmCC' />

and asks the user to either print out the QR code, or save the `Persona-ID` and `Passphrase` to a password manager.

### Saving Shared Application State
Whenever shared application state is uploaded to the Vault:

* The client generates a symmetric encryption key (`SEK`) and a monotonically-increasing nonce.

* The client performs the `PUT /users/{userId}/appState`
[operation](https://vault.brave.com/documentation#!/v1/v1usersuserIdappState_put_11) with this payload:

        { timestamp           : '...' /* optional, cf., the documentation for the PUT appState operation */
          { payload           :
            { version         : 1
            , header          :
              { publicKey     : Buffer(publicKey).toString('base64')
              , encryptedPRVK : crypto.createCipher('...', passphrase).update(privateKey).final('base64')
              }
            , data            :
              { encryptedSEK  : crypto.publicEncrypt(publicKey, SEK).toString('base64')
              , signature     : crypto.createSign('...').update(userId + ':' + nonce + ':' + state).sign(privateKey, 'base64')
              , nonce         : nonce
              , state         : crypto.createCipher('...', SEK).update(JSON.stringify({ ... }).final('base64')
              }
            }
          }
        }

* After performing the mandatory checks for the `PUT /users/{userId}/appState` operation,
the Vault verifies that `nonce` is larger than the previous value seen for this user,
then verifies the `signature` value
(by using the `publicKey` previously uploaded via the `PUT /v1/users/{userId}` operation).
On failure, HTTP code 422 is returned.
Otherwise,
the operation proceeds.

### Allowing other clients to share application data
Each client allows the user to cause it to generate and display the QR encoding of

        brave://vault/uuid/{userId}?p={passphrase}

Each client allows the user to cause it to scan an image containing a QR encoding,
determine if it contains a URL with prefix `brave://vault/uuid/`,
and if so,
to extract the `userId` and `passphrase`,
and use the `GET /v1/users/{userId}/appState`
[operation](https://vault.brave.com/documentation#!/v1/v1usersuserIdappState_get_12),
which returns the current payload along with the initial user data:

        { timestamp           : '...'
          { payload           :
            { version         : 1
            , header          :
              { publicKey     : Buffer(publicKey).toString('base64')
              , encryptedPRVK : crypto.createCipher('...', passphrase).update(privateKey).final('base64')
              }
            , data            :
              { encryptedSEK  : ...
              , signature     : ...
              , nonce         : ...
              , state         : ...
              }
            }
          }
        }

Knowledge of the `passphrase` allows the new client to decipher the `privateKey`,
and thereafter to decrypt the symetric encryption key (`SEK`).

Of course,
a client may also have a preference panel allowing direct display and entry of the `userId` and `passphrase`,
in case QR coding is unavailable.

### Recovery from all Devices Reset
To recover the shared application state,
simply start a client and show it the printed QR encoding of:

        brave://vault/uuid/{userId}?p={passphrase}

### Update of Secrets
With the exception of `passphrase`,
a client may update the secrets associated with a persona-identifier by performing the `PUT /users/{userId}/appState`
operation and updating the `header`.
In this case,
it is essential for all clients to follow the synchronization
[algorithm](https://vault.brave.com/documentation#!/v1/v1usersuserId_put_10).
Note that if the `publicKey` is updated,
then the `PUT /v1/users/{userId}` operation must also be performed to inform the vault as to its value.

## Uploading Intents
When a client intent is upload to the Vault:

* The client generates a monotonically-increasing nonce.

* The client performs the `POST /v1/users/{userId}/intents`
[operation](https://vault.brave.com/documentation#!/v1/v1usersuserIdintents_post_13) with this payload of:

        { sessionId           : sessionId
        , type                : '...'
        , payload             :
          , signature         : crypto.createSign('...').update(userId + ':' + sessionId + ':' + nonce + ':' + intent).sign(privateKey, 'base64')
          , nonce             : nonce
          , intent            : '...'
          }
        }

Note that since the content of `intent` must be interpreted by the Vault,
and this operation occurs over HTTPS,
the `intent` is not encrypted.

## It is claimed that...
The client knows everything: the `userId`, `passphrase`, `publicKey/privateKey`.
If the persistant storage of a  client is compromised,
then the corresponding persona is comprised.

A client (with the `userId`) is able to perform the `GET /v1/users/{userId}/appState` operation,
which returns the `header` object containing the `publicKey` in plaintext and
`privateKey` in ciphertext.
At this point,
a client (with the `passphrase`) is able to decipher the `privateKey`
and thereafter able to decrypt the `SEK` to decipher the `state`,
and use the `publicKey` to verify the `signature`.

The Vault knows the `userId` and `publicKey`,
which is sufficient to validate the `signature` of a `payload` attribute.

By examining the Vault's database,
a third-party can also retrieve the `publicKey`,
but has no information sufficient to derive the `passphrase` or `privateKey`,
thereby rendering the encrypted `state` unusable.