# Fire Enrich(self hosted) – Backend Integration Guide (One Pager)

This guide shows how to integrate the Fire Enrich API from your backend. The API enriches contact rows (identified by an email) with the fields you request and notifies you via webhooks.

## Overview

- Call `POST /api/enrich/async` with your rows, requested fields, and a `webhookUrl`.
- Receive webhooks per row (`enrichment.result`) and once at the end (`enrichment.completed`).
- Security: Server-to-server only using `X-Internal-Token`. Do not call from browsers.

## Prerequisites

On the Fire Enrich deployment (e.g., Vercel):

- `OPENAI_API_KEY`
- `FIRECRAWL_API_KEY`
- `INTERNAL_API_TOKEN` (shared secret for auth)
- Optional: `WEBHOOK_SECRET` (adds `X-Fire-Enrich-Signature` HMAC for webhook bodies)

When `INTERNAL_API_TOKEN` is set, the browser UI is disabled and shows API-only instructions.

## Auth

Include this header on every API request:

```
X-Internal-Token: <INTERNAL_API_TOKEN>
```

## Create Job (Async)

- Endpoint: `POST /api/enrich/async`
- Headers: `Content-Type: application/json`, `X-Internal-Token: <secret>`
- Body (either `fields` or `fieldNames` is required):

```
{
  "rows": [{ "email": "user@company.com" }],
  "emailColumn": "email",
  "fields": [
    { "name": "Company Name", "displayName": "Company Name", "description": "", "type": "string", "required": false },
    { "name": "Website", "displayName": "Website", "description": "", "type": "string", "required": false }
  ],
  "webhookUrl": "https://your.app/webhooks/enrichment",
  "nameColumn": "name",            // optional
  "metadata": { "batchId": "abc" } // optional
}
```

Response (202):

```
{ "success": true, "jobId": "...", "totalRows": 1, "status": "accepted" }
```

### Node.js example

```
await fetch(`${process.env.FIRE_ENRICH_BASE_URL}/api/enrich/async`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-Internal-Token': process.env.INTERNAL_API_TOKEN,
  },
  body: JSON.stringify({
    rows: [{ email: 'user@company.com' }],
    emailColumn: 'email',
    fieldNames: ['Company Name', 'Website', 'Industry'],
    webhookUrl: 'https://your.app/webhooks/enrichment',
    metadata: { batchId: 'abc-123' },
  }),
});
```

## Webhooks

Events are POSTed to your `webhookUrl` as JSON. Headers include `Content-Type: application/json` and, if configured, `X-Fire-Enrich-Signature` (HMAC-SHA256 of the raw body using `WEBHOOK_SECRET`).

Event types:

- `enrichment.result` – per row with `rowIndex`, `result` and `progress`.
- `enrichment.completed` – final summary.
- `enrichment.cancelled` – job aborted.
- `enrichment.failed` – job error.

Example payload (per result):

```
{
  "event": "enrichment.result",
  "jobId": "1700000000-abc123",
  "timestamp": "2025-01-01T00:00:00.000Z",
  "rowIndex": 0,
  "result": {
    "rowIndex": 0,
    "originalData": { "email": "user@company.com" },
    "enrichments": {
      "Company Name": {
        "field": "Company Name",
        "value": "Acme Corp",
        "confidence": 0.92,
        "source": "https://acme.com/about",
        "sourceContext": [ { "url": "https://acme.com/about", "snippet": "Acme Corp..." } ]
      }
    },
    "status": "completed"
  },
  "progress": { "processedRows": 1, "totalRows": 1 },
  "metadata": { "batchId": "abc-123" }
}
```

### Verify signature (Node)

```
import crypto from 'crypto';

function verifySignature(rawBody, signature, secret) {
  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  return crypto.timingSafeEqual(Buffer.from(signature || '', 'hex'), Buffer.from(expected, 'hex'));
}
```

## Cancel Job

- Endpoint: `DELETE /api/enrich/async?jobId=<id>`
- Headers: `X-Internal-Token: <secret>`
- Response: `{ "success": true }`

## Optional APIs

- Sync (single row): `POST /api/enrich/sync` – returns the result immediately (also supports `webhookUrl`).
- Generate fields from prompt: `POST /api/generate-fields` – input `{ prompt: string }`, returns typed field suggestions.

## Behavior & Limits

- Skip list: Personal/educational domains (e.g., gmail.com, .edu) are auto‑skipped with a reason.
- Max fields per request: 25.
- Throttling: small delay between rows to respect upstream limits.

## Troubleshooting

- 401 Unauthorized → Missing/invalid `X-Internal-Token`.
- 400 Bad Request → Missing `rows`, `emailColumn`, or `fields|fieldNames`.
- 413 Payload Too Large → Request body > 5 MB.
- Webhook not firing → Ensure your endpoint returns 2xx and is reachable from the internet.
