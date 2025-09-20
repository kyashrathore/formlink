# useSend Email Actions TODO

We send email actions through our self-hosted useSend instance instead of the generic action runner outlined elsewhere.

## NodeJS

> Send your mail using useSend in NodeJS

## Prerequisites

- [useSend API key](https://app.usesend.com/dev-settings/api-keys) (staging key currently `us_tv80mb8fkt_c7da81107a4233d8268b2a6ddee9dbcb`, store it as `USE_SEND_API_KEY` in your environment)
- [Verified domain](https://app.usesend.com/domains)
- Base URL for the self-hosted deployment (export as `USE_SEND_BASE_URL`, e.g. `https://usesend.staging.formlink.internal`)

## Using SDK

### Install SDK

```bash
npm install usesend-js
```

```bash
yarn add usesend-js
```

```bash
pnpm add usesend-js
```

```bash
bun add usesend-js
```

### Initialize SDK

Get the API key from the [useSend dashboard](https://app.usesend.com/dev-settings/api-keys) and initialize the SDK.

```javascript
import { UseSend } from "usesend-js";

const usesend = new UseSend(process.env.USE_SEND_API_KEY!);
```

If you are running a self-hosted version of useSend, pass the base URL as the second argument:

```javascript
const usesend = new UseSend(process.env.USE_SEND_API_KEY!, process.env.USE_SEND_BASE_URL);
```

## Send Email

```javascript
await usesend.emails.send({
  to: "hello@acme.com",
  from: "hello@company.com",
  subject: "useSend email",
  html: "<p>useSend is the best open source product to send emails</p>",
  text: "useSend is the best open source product to send emails",
});
```

## Adding contacts programatically

### Get the contact book id

Get the contact book id from the [useSend dashboard](https://app.usesend.com/contacts/). Copy the contact book id.

### Add contacts

```javascript
await usesend.contacts.create("clzeydgeygff", {
  email: "hey@koushik.dev",
  firstName: "Koushik",
  lastName: "KM",
});
```

### Update contact

```javascript
await usesend.contacts.update("clzeydgeygff", contactId, {
  firstName: "Koushik",
  lastName: "KM",
});
```
