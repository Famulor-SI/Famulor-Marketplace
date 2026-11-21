# Acme Order Status (example)

This folder is an example of an API tool. Copy it to `connectors/<your-slug>/` and replace every value with your own app.

## What it does

When a caller asks about an order, the assistant asks for the order number and calls `GET https://api.acme.example/v1/order-status?order_number=…`. It then reads out the status and delivery date.

Example response:

```json
{ "order_number": "A-10234", "status": "shipped", "expected_delivery": "2026-11-24" }
```

Keep responses short: the assistant reads the whole JSON. Answer within a few seconds, because the caller waits on the line.

## Setup

1. In Acme, open **Settings → API** and create a key with read access to orders.
2. In Famulor, open **Tools → Agent Connectors**, select **Acme Order Status** and paste the key.
3. Assign the tool to an assistant.

## Data and privacy

Famulor sends the order number to `api.acme.example` together with your API key. No other caller data leaves Famulor. See the [Acme privacy policy](https://acme.example/privacy).
