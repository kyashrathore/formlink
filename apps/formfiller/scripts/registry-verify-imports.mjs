#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();
const SOURCE_DIR = path.join(ROOT, "components", "formlink");
const exts = new Set([".tsx", ".ts", ".jsx", ".js"]);
const BAD_PREFIX = "@formlink/ui/components";

async function* walk(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true }).catch(() => []);
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      yield* walk(full);
    } else if (exts.has(path.extname(entry.name))) {
      yield full;
    }
  }
}

async function main() {
  let issues = [];
  for await (const file of walk(SOURCE_DIR)) {
    const raw = await fs.readFile(file, "utf8");
    if (raw.includes(BAD_PREFIX)) {
      issues.push(path.relative(ROOT, file));
    }
  }
  if (issues.length) {
    console.error("Found forbidden import prefix in source files:");
    for (const f of issues) console.error("  -", f);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("registry-verify-imports failed:", err);
  process.exit(1);
});

