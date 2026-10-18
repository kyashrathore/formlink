#!/usr/bin/env node
import { readFile, readdir, stat, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join, relative, sep } from "node:path";
import { parseArgs } from "node:util";
import { FormlinkError, createAdmin, signup } from "@formlink/sdk";

const CONFIG = join(homedir(), ".formlink.json");
const DEFAULT_URL = "http://localhost:8787";

interface Config {
  url?: string;
  apiKey?: string;
}

async function loadConfig(): Promise<Config> {
  const file: Config = await readFile(CONFIG, "utf8").then(JSON.parse, () => ({}));
  return {
    url: process.env.FORMLINK_URL || file.url || DEFAULT_URL,
    apiKey: process.env.FORMLINK_API_KEY || file.apiKey,
  };
}

const saveConfig = (c: Config) => writeFile(CONFIG, JSON.stringify(c, null, 2), { mode: 0o600 });

const HELP = `formlink: headless forms from the terminal

Setup
  formlink signup <name> [--url U]          create a workspace and save its key
  formlink login <key> [--url U]            save an existing key
  formlink whoami

Forms and data
  formlink forms
  formlink form create <name>
  formlink submissions <formId> [--status S] [--limit N] [--json]
  formlink export <formId> [--format csv|json]
  formlink analytics <formId>

Hooks and secrets
  formlink hook pull <formId> [file]
  formlink hook push <formId> <file>
  formlink hook test <formId> <event> <json|@file> [--code file]
  formlink hook runs <formId>
  formlink secrets
  formlink secret set <NAME> [value]        reads stdin when value is omitted

Hosting
  formlink sites
  formlink site create <name> [--slug S] [--private] [--data formId,...]
  formlink deploy <dir> --site <siteId>
  formlink domain add <siteId> <hostname>

Env: FORMLINK_URL, FORMLINK_API_KEY (override ~/.formlink.json)`;

const out = (v: unknown) => console.log(typeof v === "string" ? v : JSON.stringify(v, null, 2));

async function readStdin() {
  const chunks: Buffer[] = [];
  for await (const c of process.stdin) chunks.push(c as Buffer);
  return Buffer.concat(chunks).toString("utf8").trim();
}

async function walk(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (e) => {
      if (e.name.startsWith(".") || e.name === "node_modules") return [];
      const p = join(dir, e.name);
      return e.isDirectory() ? walk(p) : [p];
    }),
  );
  return files.flat();
}

const TEXT = /\.(html?|css|m?js|json|svg|txt|xml|webmanifest|map|md)$/i;

async function main() {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      url: { type: "string" },
      status: { type: "string" },
      limit: { type: "string" },
      json: { type: "boolean" },
      format: { type: "string" },
      code: { type: "string" },
      slug: { type: "string" },
      private: { type: "boolean" },
      data: { type: "string" },
      site: { type: "string" },
      help: { type: "boolean", short: "h" },
    },
  });
  const [cmd, ...args] = positionals;
  if (!cmd || values.help) return out(HELP);

  const config = await loadConfig();
  const url = values.url ?? config.url!;

  if (cmd === "signup") {
    const name = args.join(" ") || "My workspace";
    const res = await signup(url, name, process.env.FORMLINK_SIGNUP_TOKEN);
    await saveConfig({ url, apiKey: res.key.secret });
    return out(`Workspace ${res.workspace.id} created. Key saved to ${CONFIG}.\nKey (shown once): ${res.key.secret}`);
  }
  if (cmd === "login") {
    const apiKey = args[0];
    if (!apiKey) throw new Error("Usage: formlink login <key>");
    const me = await createAdmin({ baseUrl: url, apiKey }).me();
    await saveConfig({ url, apiKey });
    return out(`Logged in to ${me.workspace.name} (${me.role}).`);
  }

  if (!config.apiKey) throw new Error("No API key. Run `formlink signup <name>` or `formlink login <key>`.");
  const admin = createAdmin({ baseUrl: url, apiKey: config.apiKey });
  const [a0, a1, a2, a3] = args;
  const need = (v: string | undefined, usage: string) => {
    if (!v) throw new Error(`Usage: formlink ${usage}`);
    return v;
  };

  switch (cmd) {
    case "whoami":
      return out(await admin.me());
    case "forms":
      return out((await admin.forms.list()).map((f) => ({ id: f.id, name: f.name, status: f.status, hook: f.hookVersion })));
    case "form":
      if (a0 === "create") return out(await admin.forms.create({ name: need(args.slice(1).join(" "), "form create <name>") }));
      throw new Error("Usage: formlink form create <name>");
    case "submissions": {
      const page = await admin.submissions.list(need(a0, "submissions <formId>"), {
        status: values.status,
        limit: values.limit ? Number(values.limit) : 20,
      });
      if (values.json) return out(page);
      return out(page.submissions.map((s) => ({ id: s.id, status: s.status, at: new Date(s.createdAt).toISOString(), ...s.data })));
    }
    case "export":
      return out(await admin.submissions.export(need(a0, "export <formId>"), values.format === "json" ? "json" : "csv"));
    case "analytics":
      return out(await admin.analytics(need(a0, "analytics <formId>")));
    case "hook": {
      const formId = need(a1, "hook <pull|push|test|runs> <formId>");
      if (a0 === "pull") {
        const hook = await admin.hooks.get(formId);
        if (!hook.code) return out("No hook set.");
        if (a2) return writeFile(a2, hook.code).then(() => out(`Wrote v${hook.version} to ${a2}`));
        return out(hook.code);
      }
      if (a0 === "push") {
        const res = await admin.hooks.set(formId, await readFile(need(a2, "hook push <formId> <file>"), "utf8"));
        return out(res);
      }
      if (a0 === "test") {
        const event = need(a2, "hook test <formId> <event> <json|@file>") as Parameters<typeof admin.hooks.test>[1];
        const raw = need(a3, "hook test <formId> <event> <json|@file>");
        const input = JSON.parse(raw.startsWith("@") ? await readFile(raw.slice(1), "utf8") : raw);
        const code = values.code ? await readFile(values.code, "utf8") : undefined;
        const res = await admin.hooks.test(formId, event, input, code);
        out(res);
        if (res.error) process.exitCode = 1;
        return;
      }
      if (a0 === "runs") return out(await admin.hooks.runs(formId));
      throw new Error("Usage: formlink hook <pull|push|test|runs> <formId>");
    }
    case "secrets":
      return out(await admin.secrets.list());
    case "secret": {
      if (a0 !== "set") throw new Error("Usage: formlink secret set <NAME> [value]");
      const name = need(a1, "secret set <NAME> [value]");
      await admin.secrets.set(name, a2 ?? (await readStdin()));
      return out(`Saved ${name}.`);
    }
    case "sites":
      return out((await admin.sites.list()).map((s) => ({ id: s.id, name: s.name, visibility: s.visibility, url: s.shareUrl })));
    case "site":
      if (a0 === "create")
        return out(
          await admin.sites.create({
            name: need(args.slice(1).join(" "), "site create <name>"),
            slug: values.slug,
            visibility: values.private ? "private" : "public",
            dataForms: values.data ? values.data.split(",") : [],
          }),
        );
      throw new Error("Usage: formlink site create <name>");
    case "deploy": {
      const dir = need(a0, "deploy <dir> --site <siteId>");
      const siteId = need(values.site, "deploy <dir> --site <siteId>");
      if (!(await stat(dir)).isDirectory()) throw new Error(`${dir} is not a directory`);
      const files: Record<string, string | Uint8Array> = {};
      for (const path of await walk(dir)) {
        const rel = relative(dir, path).split(sep).join("/");
        files[rel] = TEXT.test(rel) ? await readFile(path, "utf8") : new Uint8Array(await readFile(path));
      }
      const res = await admin.sites.deploy(siteId, files);
      return out(`Deployed ${res.files} files (${res.bytes} bytes): ${res.site.shareUrl}`);
    }
    case "domain":
      if (a0 === "add") return out(await admin.domains.add(need(a1, "domain add <siteId> <hostname>"), need(a2, "domain add <siteId> <hostname>")));
      throw new Error("Usage: formlink domain add <siteId> <hostname>");
    default:
      throw new Error(`Unknown command: ${cmd}\n\n${HELP}`);
  }
}

main().catch((err) => {
  if (err instanceof FormlinkError) console.error(`Error ${err.status} ${err.code}: ${err.message}${err.details ? `\n${JSON.stringify(err.details, null, 2)}` : ""}`);
  else console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
