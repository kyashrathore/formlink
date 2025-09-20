import { UseSend } from "usesend-js";

const argv = process.argv.slice(2);
const getArg = (flag) => {
  const index = argv.indexOf(flag);
  if (index === -1) return undefined;
  return argv[index + 1];
};

const apiKey = process.env.USE_SEND_API_KEY ?? process.env.USE_SEND_API;
if (!apiKey) {
  console.error(
    "Missing useSend API key. Set USE_SEND_API_KEY or USE_SEND_API in your environment." 
  );
  process.exit(1);
}

const baseUrl = getArg("--base-url") ?? process.env.USE_SEND_BASE_URL ?? process.env.USESEND_BASE_URL;
const to = getArg("--to") ?? process.env.USE_SEND_TEST_TO;
const from = getArg("--from") ?? process.env.USE_SEND_TEST_FROM;

if (!to || !from) {
  console.error(
    "Missing required recipient or sender. Provide --to/--from or set USE_SEND_TEST_TO/USE_SEND_TEST_FROM."
  );
  process.exit(1);
}

const subject = getArg("--subject") ?? "useSend test email";
const text = getArg("--text") ?? "useSend test email sent via scripts/send-usesend-test.mjs";
const html = getArg("--html") ?? `<p>${text}</p>`;

const usesend = baseUrl ? new UseSend(apiKey, baseUrl) : new UseSend(apiKey);

async function main() {
  try {
    const result = await usesend.emails.send({
      to,
      from,
      subject,
      text,
      html,
    });

    if (result.error) {
      console.error("useSend email failed:");
      console.error(JSON.stringify(result.error, null, 2));
      process.exit(1);
    }

    console.log("useSend accepted the email:");
    console.log(JSON.stringify(result.data, null, 2));
  } catch (error) {
    console.error("useSend email failed:");
    if (error instanceof Error) {
      console.error(error.message);
    } else {
      console.error(error);
    }
    process.exit(1);
  }
}

void main();
