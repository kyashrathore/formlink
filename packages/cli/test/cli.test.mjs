// Runs the built CLI against a running worker (FORMLINK_URL, default http://localhost:8787). Skips if none.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

const BASE = process.env.FORMLINK_URL ?? "http://localhost:8787";
const up = await fetch(BASE).then(() => true, () => false);
const home = mkdtempSync(join(tmpdir(), "formlink-cli-"));
const cli = (...args) =>
  execFileSync("node", [new URL("../dist/index.js", import.meta.url).pathname, ...args], {
    env: { ...process.env, HOME: home, FORMLINK_URL: BASE, FORMLINK_API_KEY: "" },
    encoding: "utf8",
  });

test("signup, form, hook, deploy", { skip: !up && "no worker running" }, () => {
  assert.match(cli("signup", "cli-test"), /Key saved/);
  const form = JSON.parse(cli("form", "create", "CLI form"));
  const hookFile = join(home, "hook.js");
  writeFileSync(hookFile, "export default { price() { return { amount: 500, currency: 'usd' } } }");
  assert.match(cli("hook", "push", form.id, hookFile), /"version": 1/);
  assert.match(cli("hook", "test", form.id, "price", "{}"), /"amount": 500/);
  const site = JSON.parse(cli("site", "create", "CLI site"));
  const dist = join(home, "dist");
  mkdirSync(join(dist, "assets"), { recursive: true });
  writeFileSync(join(dist, "index.html"), "<p>cli</p>");
  writeFileSync(join(dist, "assets", "a.css"), "p{}");
  assert.match(cli("deploy", dist, "--site", site.id), /Deployed 2 files/);
});
