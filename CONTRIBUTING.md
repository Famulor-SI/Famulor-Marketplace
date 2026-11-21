# Contributing

Thanks for building for Famulor. A pull request here adds one folder: a connector that Famulor assistants can call, or an automation template. The Famulor team reviews every pull request before anything reaches the app.

Read the [README](README.md) first for what each entry becomes in the app.

## Before you start

- **Submit only what you own or may publish.** If you list an app under its brand, you work for the vendor or have its permission. Source the endpoint from the vendor's own domain, not a personal server or a proxy.
- **One entry per pull request.** It keeps review and rollback simple.
- **Unsure whether it fits?** [Open a request](https://github.com/Famulor-SI/famulor-marketplace/issues/new?template=request-app.yml) first and say that you'll build it.

## Add a connector

1. Copy an example:
   - `examples/connectors/acme-orders-mcp` for a remote MCP server
   - `examples/connectors/acme-order-status` for a single API request
2. Rename the folder to your slug, for example `connectors/acme-crm`. The slug is lowercase letters, digits and hyphens. It never changes after merge.
3. Fill in `connector.json`, replace `logo.svg` and rewrite `README.md`.
4. Test it in a Famulor workspace (see [Test before you submit](#test-before-you-submit)).
5. Run the checks and open the pull request.

### connector.json

| Field | What to put in |
| --- | --- |
| `slug` | Same as the folder name |
| `name` | App name as users know it |
| `version` | `1.0.0`; raise it with every change |
| `description` | One or two sentences for the store card: what the assistant can do with the app |
| `category` | `crm`, `calendar`, `telephony`, `automation`, `productivity`, `utility` or `other` |
| `kind` | `mcp` for an MCP server, `api_tool` for one HTTPS request |
| `publisher` | Company name and website |
| `maintainers` | GitHub usernames that answer questions about the entry |
| `license` | SPDX id of the folder's content, for example `MIT` |
| `homepage`, `docs_url` | Product page and a public setup guide |
| `privacy_url` | Privacy policy covering the data the connector receives |
| `support` | Support page (`https://…`) or address (`mailto:…`) |
| `logo` | `logo.svg` or `logo.png` in the folder: square, at least 128 px, at most 100 KB |
| `network` | Every host the connector calls, for example `api.acme.example` or `*.acme.example` |
| `setup_instructions` | Shown in the install dialog: where the user finds each value |
| `config_schema` | The install form (see below) |
| `template` | The tool Famulor creates on install (see below) |

[`schemas/connector.schema.json`](schemas/connector.schema.json) describes every field. Editors such as VS Code use it for autocompletion through the `$schema` line.

### The install form: config_schema

Each field asks the user for one value. `template` uses it as `{{key}}`.

```json
{ "key": "api_key", "label": "Acme API key", "type": "password", "required": true, "help": "Settings → API in your Acme account." }
```

- `type` is `text`, `textarea`, `password`, `url`, `number` or `select` (with `options`).
- Use `password` for every key or token. Famulor stores it as a secret and masks it in the app and the API.
- Every field must appear in `template`, and an optional field needs a `default_value`.
- Ask for as few values as possible. Most connectors need one key.

### template for an MCP server

With a key or token in one header:

```json
{
  "type": "mcp",
  "name": "acme_crm",
  "description": "Read and update Acme CRM contacts and deals.",
  "url": "https://mcp.acme.example/mcp",
  "headers": { "Authorization": "Bearer {{api_key}}" }
}
```

With sign-in instead of a key (your server supports MCP authorization with discovery, dynamic client registration and PKCE). `config_schema` stays empty:

```json
{ "type": "mcp_oauth", "mcp_url": "https://mcp.acme.example/mcp" }
```

To offer both, add `"oauth_mcp_url"` to the first form.

- Famulor connects over HTTPS. A URL ending in `/mcp` uses Streamable HTTP, a URL ending in `/sse` uses Server-Sent Events.
- Famulor stores one header per MCP connector.
- Users can turn single tools of your server off. Name and describe each tool so the assistant knows when to call it.

### template for an API tool

```json
{
  "type": "api",
  "name": "get_order_status",
  "description": "Get the status of an Acme order. Call it when the caller asks where their order is and has given the order number.",
  "method": "GET",
  "url": "https://api.acme.example/v1/order-status",
  "headers": { "X-Api-Key": "{{api_key}}" },
  "parameters": [
    { "name": "order_number", "type": "string", "description": "The order number the caller gives, for example A-10234.", "required": true, "location": "query" }
  ],
  "timeout_ms": 8000,
  "filler_phrase": "One moment, I'm checking your order."
}
```

| Field | Notes |
| --- | --- |
| `name` | Function name the assistant calls: letters, digits, `_` and `-` |
| `description` | Tells the assistant what the tool does and when to call it |
| `method` | `GET`, `POST`, `PUT`, `PATCH` or `DELETE` |
| `parameters` | `type` is `string`, `number` or `boolean`. `source: "llm"` lets the assistant fill the value; `source: "static"` takes it from `static_values`. `location` is `query` or `body`. A string parameter can list choices in `enum`. |
| `response_mapping` | Optional: saves fields of the JSON response as variables, for example `{ "order_status": "data.status" }` |
| `timeout_ms` | 1,000 to 30,000. The caller waits on the line, so answer within a few seconds. |
| `async` | `true` if the conversation shouldn't wait for the answer |
| `filler_phrase` | What the assistant says while the request runs |

### Write tools for a conversation

Famulor assistants talk to callers on the phone and to customers in chat, WhatsApp and email.

- **Answer fast and short.** Return the fields the assistant needs, not a full record. Every second counts on a call.
- **Read first.** Start with read tools. For tools that create, change, delete, send or pay, say in the description that the assistant confirms with the customer first, and explain it in the README.
- **Return clear errors.** "No order with this number" helps the assistant; a stack trace doesn't.
- **Describe, don't instruct.** Descriptions say what a tool does. They never tell the assistant to ignore its instructions, hide something from the customer or change its role.

### README.md of a connector

Use these sections; the check looks for them:

- `## What it does`: the tools and what the assistant can do with them
- `## Setup`: where the user gets each value and which permissions the key needs
- `## Data and privacy`: which data Famulor sends to your service, where it's processed and how long you keep it

## Add an automation template

1. Build and test the automation in Famulor.
2. Open it, choose **⋯ → Export** and save the file as `automation.famulor-automation.json` in `automations/<slug>/`. Don't edit the file by hand.
3. Add `listing.json` (copy it from `examples/automations/no-booking-sms-follow-up`):

| Field | What to put in |
| --- | --- |
| `slug` | Same as the folder name |
| `version` | `1.0.0`; raise it with every change |
| `category` | `calls`, `bookings`, `leads`, `messaging`, `crm` or `team` |
| `about` | When it runs and what it does |
| `setup_hint` | What the user still picks after using the template, for example the assistant and the SMS sender |
| `connectors` | Optional: slugs of connectors in this repository that the template needs |
| `maintainers`, `license` | As for connectors |

4. Write `README.md` with `## What it does` and `## Setup`.

The export removes keys, connections, webhook addresses and workspace ids. Text you typed into steps stays: check messages, prompts, email addresses and code for personal data and replace them with placeholders such as `[your booking link]`.

## Test before you submit

- **MCP server:** in **Agent Tools → Agent Connectors**, choose **Add custom MCP connector** (sign-in) or create a **Custom Agent Tool** of type MCP server (key in a header). Assign it to an assistant and test it in a call or chat.
- **API tool:** create a **Custom Agent Tool** of type API tool with the same values as your template, then test it.
- **Automation template:** import your file with **Import** next to **New** and run it once.

Mention in the pull request what you tested.

## Run the checks

These are the commands CI runs. You need Node.js 20 or later; nothing is installed.

```bash
node scripts/validate.mjs            # all entries
node scripts/validate.mjs connectors/acme-crm   # one entry
node scripts/build-catalog.mjs       # update catalog.json
node --test scripts/validate.test.mjs
```

## What review checks

| Area | What we look for |
| --- | --- |
| Ownership | Publisher, domain and endpoints belong to the app; maintainers can be reached |
| Security | No secrets in files, HTTPS only, every host declared, least access, no hidden behavior (see [SECURITY.md](SECURITY.md)) |
| Conversation quality | Clear tool names and descriptions, short answers, confirmation before write actions |
| Data protection | A privacy policy that covers the data, and a README that says which data leaves Famulor |
| Duplicates | Not already in the app or this repository |
| Checks | CI is green and `catalog.json` is current |

We reply in the pull request. After merge, we add the entry to the app with the next release and comment when it's live.

## Common reasons a pull request is sent back

- A key, token, workspace id or customer data in a file.
- A host the template calls is missing from `network`.
- A secret in the URL instead of a header.
- Vague descriptions such as "Acme tool" that don't tell the assistant when to call it.
- Write actions without a confirmation step.
- `catalog.json` wasn't regenerated.
- A branded connector from a personal account or a third-party proxy.

## Update or remove an entry

- **Update:** change the files, raise `version` and open a pull request. Explain what changes for users who already installed it.
- **Remove:** open an issue or a pull request that deletes the folder. We remove it from the app first, so users can disconnect it in time.

By contributing, you agree that your contribution is published under the license stated in the entry, and that you follow the [code of conduct](CODE_OF_CONDUCT.md).
