<!--
Read CONTRIBUTING.md first. Run before you open the pull request:
  node scripts/validate.mjs
  node scripts/build-catalog.mjs
-->

## What this adds or changes

- Entry: <!-- connectors/<slug> or automations/<slug> -->
- New or update: <!-- for an update, say what changed and raise "version" -->
- What a Famulor user can do with it, in one real example:

## Ownership

- [ ] I own this app or brand, or I may publish an integration for it.
- [ ] `publisher`, `homepage` and the endpoints belong to that app (not a personal account or a proxy).

## Checks

- [ ] `node scripts/validate.mjs` passes.
- [ ] `catalog.json` is regenerated with `node scripts/build-catalog.mjs`.
- [ ] I tested it in a Famulor workspace (connectors: as a custom MCP connector or API tool; templates: imported the file).
- [ ] The README explains setup and which data the app receives.

## Security

- [ ] No keys, tokens, customer data, phone numbers or workspace ids in any file.
- [ ] The connector only gets the access its description needs.
- [ ] Every host it calls is listed in `network`.
- Write actions (create, change, delete, send, pay) and how the assistant confirms them first:

## Notes for reviewers
