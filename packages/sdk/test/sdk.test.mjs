// Integration test against a running Formlink worker (FORMLINK_URL, default http://localhost:8787).
// Skips when no worker is reachable. Run `pnpm build` first.
import assert from "node:assert/strict";
import { test } from "node:test";
import { FormlinkError, createAdmin, createForm, signup } from "../dist/index.js";

const BASE = process.env.FORMLINK_URL ?? "http://localhost:8787";
const up = await fetch(BASE).then(() => true, () => false);

test("form and admin clients", { skip: !up && "no worker running" }, async () => {
  const { key } = await signup(BASE, "sdk-test");
  const admin = createAdmin({ baseUrl: BASE, apiKey: key.secret });
  const created = await admin.forms.create({ name: "SDK form", settings: { retentionDays: 7 } });
  await admin.hooks.set(
    created.id,
    `export default { beforeSubmit({ submission }) { return submission.data.ok ? { computed: { n: 1 } } : { errors: { ok: "Required" } }; } }`,
  );

  const form = createForm({ formId: created.id, baseUrl: BASE });
  assert.match(form.sessionId, /^s_/);
  assert.equal((await form.info()).open, true);
  form.track("view");
  await form.saveDraft({ ok: false });
  const file = await form.upload(new Blob(["hi"], { type: "text/plain" }), "a.txt");
  assert.equal(file.size, 2);

  await assert.rejects(form.submit({ ok: false }), (err) => err instanceof FormlinkError && err.fieldErrors?.ok === "Required");
  const res = await form.submit({ ok: true }, { meta: { utm_source: "test" } });
  assert.deepEqual(res.computed, { n: 1 });

  const sub = await admin.submissions.get(res.id);
  assert.equal(sub.meta.utm_source, "test");
  assert.equal(sub.files?.length, 1);
  assert.equal((await admin.submissions.all(created.id)).length, 1);
  assert.match(await admin.submissions.export(created.id), /ok/);

  const site = await admin.sites.create({ name: "SDK site" });
  const dep = await admin.sites.deploy(site.id, { "index.html": "<p>sdk</p>", "x.bin": new Uint8Array([1, 2, 3]) });
  assert.equal(dep.files, 2);
  assert.equal(await (await fetch(dep.site.url)).text(), "<p>sdk</p>");

  await admin.sites.delete(site.id);
  await admin.forms.delete(created.id);
});
