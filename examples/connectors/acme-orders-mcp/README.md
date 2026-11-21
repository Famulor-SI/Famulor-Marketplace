# Acme Orders (example)

This folder is an example. Copy it to `connectors/<your-slug>/` and replace every value with your own app.

## What it does

Your assistant can look up an order by order number or email address and tell the customer its status, delivery date and return options. The connector is read-only: it cannot change or cancel orders.

Tools on the MCP server:

| Tool | What it returns |
| --- | --- |
| `get_order` | Status, items and delivery date of one order |
| `find_orders_by_email` | The last five orders of a customer |
| `return_options` | Whether an order can be returned and until when |

## Setup

1. In Acme, open **Settings → API** and create a key with read access to orders.
2. In Famulor, open **Tools → Agent Connectors**, select **Acme Orders** and paste the key.
3. Assign the connector to an assistant.

## Data and privacy

Famulor sends the order number or email address the customer gives to `mcp.acme.example`. Acme returns order details and stores no conversation data. See the [Acme privacy policy](https://acme.example/privacy).

## Support

Questions about this connector: support@acme.example.
