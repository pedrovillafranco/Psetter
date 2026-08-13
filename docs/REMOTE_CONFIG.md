# Remote configuration boundary

Psetter can use an optional remote configuration file. This file contains operational data only. It does not contain executable or interpreted logic.

If the request fails, or if the response is invalid, Psetter uses safe local default values.

The complete version 1 schema is:

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
- Psetter can store the last valid response locally for the configured five-minute freshness window. After this period, the response expires. Expired emergency flags do not remain active when Psetter is offline.

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

The remote configuration request does not send answer content, settings, or usage counts.
