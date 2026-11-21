# Security

Report a vulnerability in a listed connector, template or in this repository privately to **support@famulor.io** with the subject “Security: Famulor Marketplace”. Include the affected entry, a minimal redacted reproduction and the possible impact. Do not open a public issue for it, and never post credentials, tokens or conversation content.

## What review checks

Every pull request is reviewed by the Famulor team before it reaches the app. We reject or send back entries that:

- run or download code at install time, or ask users to paste a script into a terminal;
- read or send secrets, tokens or environment variables to an undisclosed endpoint;
- request more access than the description needs (for example write access for a read-only connector);
- hide behavior: minified or obfuscated payloads, unexplained redirects, URL shorteners;
- contain prompt injection in a description, tool name or template text aimed at the assistant that uses it;
- impersonate a brand the contributor does not own or represent.

## After merge

A merged entry is still third-party software. Famulor can remove an entry from the app and from this catalog at any time, for example after a security report or when the endpoint stops responding. Workspace owners decide which connectors their assistants may use and can disconnect them in the app.
