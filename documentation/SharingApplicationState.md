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

* _awaiting UX review_

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

* The client also generates an 32-octet `privateKey` (for signing with `ECDSA`)
and a 32-octet `passKey` (for encryption with `AES-GCM`), that is persisted in the client.
The client also calculates the corresponding `publicKey` for the `privateKey`.

* The client performs the `PUT /v1/users/{personaID}`
[operation](https://vault.brave.com/documentation#!/v1/v1userspersonaID_put_10) with this payload:

        { envelope           :
          { version          : 1 // at present
          , privateKey       : to_hex(crypt.subtle.encrypt(
              { name         : 'AES-GCM'
              , iv           : from_hex(envelope.iv)
              , key          : from_hex(passKey)
              , data         : ecdsa.privateKey
              }))
          , iv               : to_hex(crypto.getRandomValues(new UInt8Array(12)))
          , publicKey        : to_hex(ecdsa.publicKey)
          }
        }

  For example:

        { envelope           :
          { version          : 1
          , privateKey       : 'ab762a4cdbbfaad2a1784d2441f4a8713e8842a0ec6c33d79a9abc1338a4ff1b72cb69784b1c0efa337db4ebadacba1a'
          , iv               : '9478e593fdaa5150f7de59ac'
          , publicKey        : '043f1f0265c9abea98aa96e39b4739e7439beb1e65d783bb56afe3f9650d6584ebf8c579ce4630b83901674e23249d32c6cf6dab866d55d1a1f12a16d6c6ccf8bf'
          }
        }

  NB: the IV was extracted from the front of the encrypted output (privateKey) into a separate field (iv).

* Immediately prior to the first time that the client wishes to store shared application state,
the client displays:

        Persona-ID: {personaID}
        PassKey: {passKey}

along with the QR encoding for:

        brave://vault/persona/{personaID}?p={passKey}

For example,

        brave://vault/persona/160395dd-bb88-4170-93ff-4698c7c1f097?p=7a6c54de75f863c7bb50643d12c4395200c1cb83da61bbbbdf445aa661c3c4ff

encodes as:

<img src='data:image/jpeg;base64,iVBORw0KGgoAAAANSUhEUgAAAeoAAAHqAQMAAADxo595AAAABlBMVEX///8AAABVwtN+AAAC/0lEQVR4nO2aWw6jMAxFI3UBLImtsyQWgORp4leg1UjF/Mzo3A9aSo77c2XHDq0hhBBCCKH/R2I6mmztJW3t30Qvb23L8V6kF1+6gYMXcb1ZjggUUFeP9r6IWIwkwMEL+GLrRfamzh3fLOQ+jGy4mxsc/Dn8vbQNfLJv+BUc/Hm8rW7VUYw9S1qqtH8AB38EbwYN06ZVxwPPnK+paIODl3FTN+Py94svBQcv4rNygWZOt+p6TZDg4CVcWxCRLNBWmzVLbrrE9otWqsHBi/hoN9SgbaxqFih2ie7cSKng4DV8kKdtoefGLk+fR4R8CTh4Ge/K+d5UlkfSbN6MWA7dryg4+O+4JUg37Vig6TPjrmHf7eOPwcFv43GCO/lVQzbNklqb7fQDHLyGx5FZdh/m3Bb2PUUDB6/i005vzUAx34shs6VKz6Hg4CVcwpEyDi+y3TjH/bqhBAe/gXePeoHeM3N6R7zF4MVMe53bgIPfxnNBbBAjrs2hNZoIOHgVT6u6N495M5h9yOaLzwIH/x1P05o3RcKb5lct0GFfcPA6rs9Ore2qMc5Hux7oSwcNDv4TrmU5nJuNh//WP6Yu+Tp4AQf/HZeovnqJQDlkkZAN/sDBi7jWYe95bQ7TpWV5iXcJvk5fwMFv4b4jbDrfO62fBi897pfBCzj4DdzejBJ37uVFqVA6t4GD13Dvb7u05xidrp2g2a2eeXgN38DBq7j71fsQH7LEuHmaPjdw8AdwzYjhTbHe5FSbdZ0OXsDB67gppsr9mTXDvi28tiXg4I/gOd+LzOmnaj5p7g/GWnDwKq7HaNEHn7JkjGDEFVUaHLyAz4GyBd4zVc5W9X8ABy/hbkerw9aCXDLn/mlkcPACrhbM4XF8W2PwrLgvPpsWHPwOPvqQ5Qj7ytSWWPexxJOPVAkOXsFttNfO6VNkPrwdtw0c/DG8TaO9l+R8L9+W8hoODl7Ex4eX5WFWH+2J97wx6RP9DRy8hptyvue34r2JtyCn16jAwe/jCCGEEELoX9cfj4zmlfvx/+gAAAAASUVORK5CYII=' />

and asks the user to either print out the QR code, or save the `Persona-ID` and `passKey` to a password manager.

### Saving Shared Application State
There is one operation that clients may use to upload shared application state to the Vault:

        PUT  /v1/users/{personalID}/sessions/{sessionId}/types/{type}

For each operation:

* The client generates a 32-octet `cipherKey` (for encryption with `AES-GCM`)
and a non-repeating (e.g., monotonically-increasing) nonce.

* The client performs the operation with this payload:

        { envelope           : {
            signature        : to_hex(crypt.subtle.sign(
              { name         : 'ECDSA'
              , hash         :
                { name       : 'SHA-256' }
              , privateKey   : ecdsa.privateKey
              , data         : personaID + ':' + envelope.nonce + ':' + envelope.payload
              }))
          , cipherKey        : to_hex(crypt.subtle.encrypt('
              { name         : 'AES-GCM'
              , iv           : from_hex(envelope.iv)
              , key          : from_hex(passKey)
              , data         : crypto.getRandomValues(new Uint8Array(32))
              }))
          , iv               : to_hex(crypto.getRandomValues(new UInt8Array(12)))
          , nonce            : to_hex(crypto.getRandomValues(new UInt8Array(32)))
          }
        , payload          : to_hex(crypt.subtle.encrypt(
            { name         : 'AES-GCM'
            , iv           : envelope.cipherKey.iv
            , key          : envelope.cipherKey.data
            , data         : JSON.stringify({ ... })
            }))
        }

* After performing the mandatory checks for the operation,
the Vault verifies the `envelope.signature` value
(by using the `envelope.publicKey` previously uploaded),
then verifies that `envelope.nonce` is unique for this user.
On failure, HTTP code 422 is returned.
Otherwise,
the operation proceeds.

### Uploading Intents
For the `POST /v1/users/{personaID}/intents` operation:

* The client generates a non-repeating (e.g., monotonically-increasing) nonce.

* The client performs the operation with this payload:

        { envelope           : {
            signature        : to_hex(crypt.subtle.sign(
              { name         : 'ECDSA'
              , hash         :
                { name       : 'SHA-256' }
              , privateKey   : ecdsa.privateKey
              , data         : personaID + ':' + envelope.nonce + ':' + JSON.stringify(envelope.intent)
              }))
          , nonce            : to_hex(crypto.getRandomValues(new UInt8Array(32)))
          }
        , intent             :
          { sessionID        : '...'
          , type             : '...'
          , timestamp        : '...'
          , payload          : { ... }
          }
        }

* After performing the mandatory checks for the operation,
the Vault verifies the `envelope.signature` value
(by using the `envelope.publicKey` previously uploaded),
then verifies that `envelope.nonce` is unique for this user.
On failure, HTTP code 422 is returned.
Otherwise,
the operation proceeds.

Note that since the content of `intent` must be interpreted by the Vault,
and this operation occurs over HTTPS,
the `intent` is not encrypted.

### Allowing other clients to share application data
Each client allows the user to cause it to generate and display the QR encoding of

        brave://vault/persona/{personaID}?p={passKey}

Each client allows the user to cause it to scan an image containing a QR encoding,
determine if it contains a URL with prefix `brave://vault/persona/`,
and if so,
to extract the `personaID` and `passKey`,
and use the `GET /v1/users/{personaID}`
[operation](https://vault.brave.com/documentation#!/v1/v1userspersonaIDappState_get_12),
which returns the current payload along with the `envelope` originally uploaded by the initial client.

Knowledge of the `passKey` (along with the original `envelope.iv`) allows the client to decipher the `privateKey`,
and thereafter to decrypt the `cipherKey` used in this operation:

        PUT  /v1/users/{personalID}/sessions/{sessionID}/types/{type}

Of course,
a client may also have a preference panel allowing direct display and entry of the `personaID` and `passKey`,
in case QR coding is unavailable.

### Recovery from all Devices Reset
To recover the shared application state,
simply start a client and show it the printed QR encoding of:

        brave://vault/persona/{personaID}?p={passKey}

## It is claimed that...
The client knows everything: the `personaID`, `passKey`, `publicKey/privateKey`.
If the persistant storage of a  client is compromised,
then the corresponding persona is comprised.

A client (with the `personaID`) is able to perform the `GET /v1/users/{personaID}` operation,
which returns the `envelope` object containing the `publicKey` in plaintext and
the `iv` and `privateKey` in ciphertext.
At this point,
a client (with the `passKey`) is able to decipher the `privateKey`
and thereafter able to decrypt any `cipherKey` to decipher the `payload` associated with an encrypted datum.
and use the `publicKey` to verify the `signature`.

The Vault knows the `personaID` and `publicKey`,
which is sufficient to validate the `signature` of a `payload` or `intent` attribute.

Neither the vault (nor a third-party) has no information sufficient to derive the `passKey` or `privateKey`,
thereby rendering any encrypted datum unusable.
