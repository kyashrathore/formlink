// Takes the Typeform-style example from the agent skill as written, hosts it on Formlink with the
// built SDK, and fills it in a real Chromium: branching, matrix, upload, signature, a hook rejection
// routed back to its question, then a successful submit. Needs `pnpm dev` and `pnpm -C packages/sdk build`.
import assert from "node:assert/strict";
import { readFileSync, readdirSync, writeFileSync, mkdtempSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_PATH ?? "playwright");

const BASE = process.env.FORMLINK_URL ?? "http://localhost:8787";
const root = new URL("../../../", import.meta.url).pathname;
let KEY = "";
const call = async (method, path, body) => {
  const res = await fetch(BASE + path, {
    method,
    headers: { authorization: `Bearer ${KEY}`, "content-type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  return text ? JSON.parse(text) : null;
};

// 1. Backend: workspace, form, a hook that rejects one email domain.
KEY = (await call("POST", "/v1/workspaces", { name: "browser" })).key.secret;
const form = await call("POST", "/v1/forms", { name: "Apply", settings: { uploads: { allowedTypes: ["application/pdf", "image/png"] } } });
await call("PUT", `/v1/forms/${form.id}/hook`, {
  code: `export default { beforeSubmit({ submission }) {
    if (String(submission.data.email).endsWith("@blocked.io")) return { errors: { email: "Use your work email." } };
    return { computed: { score: Object.values(submission.data.ratings ?? {}).reduce((a, b) => a + Number(b), 0) } };
  } }`,
});

// 2. Frontend: the skill's example verbatim, with the SDK import pointed at the local build.
const md = readFileSync(join(root, "skills/formlink/references/building-forms.md"), "utf8");
let html = md.split("## 1. Typeform-style")[1].split("```html\n")[1].split("\n```")[0];
assert.ok(html.includes('from "https://esm.sh/@formlink/sdk"'));
html = html.replace("https://esm.sh/@formlink/sdk", "./sdk/index.js").replace("frm_REPLACE_ME", form.id);
const files = { "index.html": { content: html } };
const dist = join(root, "packages/sdk/dist");
for (const f of readdirSync(dist).filter((f) => f.endsWith(".js"))) files[`sdk/${f}`] = { content: readFileSync(join(dist, f), "utf8") };
const site = await call("POST", "/v1/sites", { name: "Apply page" });
await call("POST", `/v1/sites/${site.id}/deployments`, { files });

// 3. Fill it in like a person.
const tmp = mkdtempSync(join(tmpdir(), "fl-browser-"));
const pdf = join(tmp, "cv.pdf");
writeFileSync(pdf, "%PDF-1.4\n% test cv\n");
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH });
const page = await browser.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.goto(site.url);

const title = () => page.locator("#q-title").innerText();
const ok = () => page.locator("#next").click();
await page.locator("#q-title").waitFor();
assert.match(await title(), /name/);
await page.locator("input").fill("Ada Lovelace");
await page.keyboard.press("Enter");
await page.waitForFunction(() => /reach you/.test(document.querySelector("#q-title")?.textContent ?? ""));
await page.locator("input").fill("not-an-email");
await ok();
assert.match(await page.locator("#err").innerText(), /doesn't look right/);
await page.locator("input").fill("ada@blocked.io");
await ok();
await page.waitForFunction(() => /describes you/.test(document.querySelector("#q-title")?.textContent ?? ""));
await page.keyboard.press("a"); // Founder, picked by letter key
await page.waitForFunction(() => /team/.test(document.querySelector("#q-title")?.textContent ?? ""));
assert.match(await page.locator(".num").innerText(), /4 of 8/); // branch shows team_size, hides role_other
await page.locator("input").fill("12");
await ok();
await page.waitForFunction(() => /How do we do/.test(document.querySelector("#q-title")?.textContent ?? ""));
await ok();
assert.match(await page.locator("#err").innerText(), /every row/);
for (const [row, col] of [["Speed", "5"], ["Docs", "4"], ["Support", "3"]]) await page.getByLabel(`${row}: ${col}`).check();
await ok();
await page.waitForFunction(() => /Anything else/.test(document.querySelector("#q-title")?.textContent ?? ""));
await ok(); // optional, skipped
await page.waitForFunction(() => /CV/.test(document.querySelector("#q-title")?.textContent ?? ""));
await page.locator("input[type=file]").setInputFiles(pdf);
await page.waitForFunction(() => /Uploaded: cv.pdf/.test(document.querySelector("#file-status")?.textContent ?? ""));
await ok();
await page.waitForFunction(() => /Sign/.test(document.querySelector("#q-title")?.textContent ?? ""));
const box = await page.locator("canvas").boundingBox();
await page.mouse.move(box.x + 20, box.y + 40);
await page.mouse.down();
await page.mouse.move(box.x + 120, box.y + 80, { steps: 8 });
await page.mouse.move(box.x + 220, box.y + 30, { steps: 8 });
await page.mouse.up();
await ok(); // Submit

// The hook rejects the email; the form jumps back to that question with the server's message.
await page.waitForFunction(() => /reach you/.test(document.querySelector("#q-title")?.textContent ?? ""));
assert.equal(await page.locator("#err").innerText(), "Use your work email.");
await page.locator("input").fill("ada@analytical.engine");
await ok();
// Earlier answers are kept: walk forward to the end and submit again.
for (let i = 0; i < 10; i++) {
  if (await page.getByText("Thanks, we got it.").isVisible()) break;
  if (/describes you/.test(await title())) await page.keyboard.press("a");
  else await ok();
  await page.waitForTimeout(300);
}
await page.getByText("Thanks, we got it.").waitFor();
assert.match(await page.locator("main").innerText(), /Your score: 12/);
await browser.close();
assert.deepEqual(errors, [], `page errors: ${errors.join("; ")}`);

// 4. What landed in Formlink.
const { submissions } = await call("GET", `/v1/forms/${form.id}/submissions`);
assert.equal(submissions.length, 1);
const sub = await call("GET", `/v1/submissions/${submissions[0].id}`);
assert.equal(sub.data.name, "Ada Lovelace");
assert.equal(sub.data.email, "ada@analytical.engine");
assert.equal(sub.data.role, "Founder");
assert.equal(sub.data.team_size, 12);
assert.deepEqual(sub.data.ratings, { Speed: "5", Docs: "4", Support: "3" });
assert.equal(sub.data.role_other, undefined);
assert.equal(sub.computed.score, 12);
assert.deepEqual(sub.files.map((f) => f.type).sort(), ["application/pdf", "image/png"]);
assert.ok(sub.meta.$url.endsWith(`/s/${site.slug}/`));
const a = await call("GET", `/v1/forms/${form.id}/analytics`);
assert.equal(a.views, 1);
assert.equal(a.starts, 1);
assert.equal(a.completes, 1);
assert.ok(a.steps.some((s) => s.step === "signature"));
console.log("browser check passed: skill example filled in Chromium, submission, files, score and funnel verified");
