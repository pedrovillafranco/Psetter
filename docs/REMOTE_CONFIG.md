# Remote configuration boundary

Psetter can use an optional remote configuration file. This file contains operational data only. It does not contain executable or interpreted logic.

If the request fails, or if the response is invalid, Psetter uses safe local default values.

Extension pages use an explicit `connect-src` policy. Community pages allow only
local connections. Store packaging adds only the service origin validated from
the reviewed overlay to the popup and demo policies. Browser host permission
does not override a page policy that blocks the same request.

The current version 1 schema is:

```json
{
  "schemaVersion": 1,
  "disabled": false,
  "feedbackDisabled": false,
  "minimumSupportedVersion": null,
  "compatibilityWarning": null,
  "maintenanceMessage": null,
  "developerMessage": {
    "id": "welcome-2026-08-13",
    "title": "Welcome to Psetter!",
    "text": "You’re one of the first people to use Psetter. Have fun streamlining your operations.",
    "signature": "- Pedro"
  },
  "features": {
    "contextSymbols": true,
    "symbolSearch": true
  }
}
```

Validation is fail-closed:

- Each object can contain only the specified keys. An unknown key makes the response invalid.
- A flag must be a Boolean value. A flag can select only a feature that is pre-bundled with the extension.
- A message must be a plain string with a maximum of 240 characters, or it must be `null`.
- A developer message must have a unique bounded ID, a title, and text. It can also have a signature. Psetter renders these values as inert text only.
- A version must use Chrome-style numeric version syntax, or it must be `null`.
- The response must be valid JSON. Its maximum size is 4 KiB. The response must arrive within three seconds.
- Psetter rejects redirects, credentials, and content that is not JSON.
- Psetter can store the last valid response locally for the configured five-minute freshness window. A valid emergency disable remains active after that window until a fresh valid configuration explicitly releases it; network uncertainty cannot re-enable the editor.

Only the top MITx frame makes the request. Nested course frames do not independently request parser data or configuration data. They receive the validated state from the top frame through frame messaging.

The schema exposes no remotely interpreted fields for:

- parser rules;
- regular expressions;
- selectors;
- navigation URLs;
- commands;
- JavaScript;
- WebAssembly;
- templates;
- expressions;
- data that Psetter interprets as code.

Plain message strings may contain ordinary text that resembles any of these forms, but Psetter never parses or executes message strings as rules, URLs, expressions, markup, or code.

A capability of this type requires a reviewed extension release. It must not be added only through a change to the hosted JSON file.

## Queued developer messages

The next extension release can accept up to two queued messages with the additive
`developerMessages` field. When this field is present, omit the legacy
`developerMessage` field:

```json
{
  "schemaVersion": 1,
  "disabled": false,
  "feedbackDisabled": false,
  "minimumSupportedVersion": null,
  "compatibilityWarning": null,
  "maintenanceMessage": null,
  "developerMessages": [
    {
      "id": "release-note-1",
      "title": "First notice",
      "text": "The first notice appears first.",
      "signature": "- Pedro"
    },
    {
      "id": "release-note-2",
      "title": "Second notice",
      "text": "This notice appears after the first one is dismissed.",
      "signature": "- Pedro"
    }
  ],
  "features": {
    "contextSymbols": true,
    "symbolSearch": true
  }
}
```

Psetter shows one message at a time in the existing page and popup surfaces.
Users can browse unread messages with the previous and next controls.
Minimizing or closing the panel keeps the message unread. The Dismiss control
marks only the current message as read. Psetter does not interrupt the user or
stack multiple panels. The existing `developerMessage`
object remains supported, and the existing scalar read key is still written so
an older installed copy can interpret the latest dismissal. Do not publish a
`developerMessages` config until the supporting extension release is live;
older clients reject unknown top-level fields and will safely fall back to
their cached/default configuration.

The predefined remote controls can only:

- enable or disable the pre-bundled context-symbol user interface;
- enable or disable the pre-bundled symbol-search user interface;
- show a compatibility warning;
- show a maintenance message;
- warn the user when the installed version is below a specified minimum version;
- disable feedback;
- pause the extension in an emergency.

Developer messages do not interrupt the user automatically.

If there is an unread developer message, Psetter shows a small indicator next to the existing Psetter control on MITx pages. Psetter also shows a small notice in the extension popup.

Psetter shows the message only after the user opens it. When the user dismisses the message, Psetter stores the message ID in local extension storage.

The remote configuration request does not send answer content, editor settings,
or usage counts. If the local developer token is set, the extension sends that
token in an HTTPS `Authorization` header to opt into the developer feed.

## Notification audiences and local developer opt-in

The Store extension and the developer's install use the same Store package and
version. There is no developer build or developer UI. The v2 source config tags
configured messages with `audience: "everyone"` or `audience: "developer"`.
The Worker filters those tags and removes them from the response, so Store
clients receive only `everyone` messages by default. The Worker also generates
two stable test notices in memory for authorized developer responses; they are
not stored in the shared config or included in the extension package.

Developer messages are returned only when the request includes the secret
`PSETTER_DEV_NOTIFICATION_TOKEN` configured on the Worker. The matching token
is an optional, local extension-storage setting named
`psetterDeveloperNotificationToken`. The shared Store client contains an
optional check for that key, but there is no developer UI or alternate build;
the token value is not part of runtime config, source control, or the Store
package. With the key absent, the same Store package sends ordinary public
requests. Adding the token opts that one browser profile into the developer
feed; removing it returns the profile to the public feed. The extension keeps
public and developer response caches separate and ignores a developer cache
when the token is absent. This is profile-level opt-in, not device
fingerprinting: any extension profile with the token receives the developer
feed, so keep the token private.

Set or remove the local key from Psetter's isolated content-script context.
On a MITx tab, open the browser DevTools Console and choose Psetter's content
script in the execution-context selector. First check that the selected context
has extension storage:

```js
typeof chrome !== "undefined" && typeof chrome.storage !== "undefined"
```

It should return `true`. If it returns `false`, select Psetter's content-script
context instead of `top`; if Psetter is not listed, reload a matching MITx tab
and check the selector again. Once the check returns `true`, the prompt keeps
the secret out of Console command history:

```js
{
  const token = prompt("Local Psetter developer notification token");
  if (token) await chrome.storage.local.set({ psetterDeveloperNotificationToken: token });
}
```

The audience refreshes immediately after the setting changes. To switch back
to public notifications, run this in the same context:

```js
await chrome.storage.local.remove("psetterDeveloperNotificationToken");
```

If DevTools shows requests to `store.example.invalid`, the active package came
from a packaging-test fixture. Rebuild the shared Store package with the real
overlay using `node scripts/package.mjs --channel store --store-overlay ../../psetter-infra/store-overlay`
from `psetter/psetter-extension`, then update or reload that package through
the browser's normal extension workflow. Its `runtime-config.js` should point
to `https://feedback.psetter.villafran.co/config/v2.json`.

Keep the token in a password manager or another private local store. Never add
it to an extension build, `.env` file tracked by Git, or notification config.
Public users do not receive the Worker-generated test notice text.
