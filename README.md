<p align="center">
  <a href="https://www.famulor.io">
    <picture>
      <source media="(prefers-color-scheme: dark)" srcset="https://www.famulor.io/logo-dark.svg">
      <img src="https://www.famulor.io/logo.svg" alt="Famulor" height="44">
    </picture>
  </a>
</p>

<h3 align="center">Famulor Marketplace</h3>

<p align="center">
  Connectors and automation templates for Famulor, built by app vendors and developers and reviewed by the Famulor team.
</p>

<p align="center">
  <a href="CONTRIBUTING.md">Contribute</a> ·
  <a href="https://github.com/Famulor-SI/famulor-marketplace/issues/new?template=request-app.yml">Request an app</a> ·
  <a href="https://docs.famulor.io/automations/contribute">Docs</a> ·
  <a href="SECURITY.md">Security</a>
</p>

## What you can add

| Entry | What Famulor users get | Folder |
| --- | --- | --- |
| **Connector: MCP server** | A card in **Agent Tools → Agent Connectors**. Assistants call the server's tools during calls, chats, messages and emails. Automations can use it as an MCP connection. | `connectors/<slug>/` |
| **Connector: API tool** | A card in **Agent Connectors** that installs one HTTPS request the assistant calls, for example "look up an order". | `connectors/<slug>/` |
| **Automation template** | A ready-made workflow in the template gallery (**Automation → New → Start from template**), made from a file you export in the app. | `automations/<slug>/` |

Don't want to build it yourself? [Request an app](https://github.com/Famulor-SI/famulor-marketplace/issues/new?template=request-app.yml) and describe what your assistant should do with it.

## How an entry reaches the app

1. You open a pull request with one folder: start from a copy in [`examples/`](examples).
2. The **Validate** check runs the same checks as `node scripts/validate.mjs`.
3. The Famulor team reviews ownership, security and how the connector behaves in a real conversation. We may test it in a workspace.
4. After merge, we add the entry to the app with the next release and comment on your pull request when it's live.

Merging alone doesn't change the app. Famulor can disable or remove an entry at any time, for example after a security report.

## Start in five minutes

```bash
git clone https://github.com/<you>/famulor-marketplace.git
cd famulor-marketplace
cp -R examples/connectors/acme-orders-mcp connectors/your-app
# edit connectors/your-app/connector.json, README.md and logo.svg
node scripts/validate.mjs
node scripts/build-catalog.mjs
```

You need Node.js 20 or later. The scripts have no dependencies.

[CONTRIBUTING.md](CONTRIBUTING.md) explains every field, the review and the most common reasons a pull request is sent back.

## Repository layout

| Path | Purpose |
| --- | --- |
| `connectors/` | Listed connectors, one folder each |
| `automations/` | Listed automation templates, one folder each |
| `examples/` | Copyable examples; checked by CI, never listed |
| `schemas/` | JSON Schemas for `connector.json` and `listing.json` |
| `catalog.json` | Generated index of listed entries; never edit by hand |
| `scripts/` | Checks, catalog builder and their tests |

## Disclaimer

Entries come from their publishers, not from Famulor. Famulor reviews each one before it reaches the app, but doesn't guarantee third-party services, their availability or their data practices. Each entry states its license, publisher, privacy policy and support contact. The repository's own files are licensed under [MIT](LICENSE). Using Famulor is subject to the [Famulor terms](https://www.famulor.io/terms).
