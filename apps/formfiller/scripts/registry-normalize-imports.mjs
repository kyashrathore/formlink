#!/usr/bin/env node
/**
 * Normalize imports in source components before running `shadcn registry:build`.
 *
 * Rationale: The shadcn builder expects source templates to use the app alias
 * ("@/components") so it can correctly rewrite to the configured `components`
 * alias during installation. If sources use "@formlink/ui/components", the
 * builder may infer extra roots and produce duplicate files on add.
 *
 * This script rewrites any "@formlink/ui/components" import prefix to
 * "@/components" in our registry source files under `components/formlink/*`.
 */

import fs from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();
const SOURCE_DIR = path.join(ROOT, "components", "formlink");
const exts = new Set([".tsx", ".ts", ".jsx", ".js"]);

async function* walk(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      yield* walk(full);
    } else if (exts.has(path.extname(entry.name))) {
      yield full;
    }
  }
}

async function normalizeFile(file) {
  const raw = await fs.readFile(file, "utf8");
  const replaced = raw
    // Core rewrite: UI components prefix
    .replace(/(["'])@formlink\/ui\/components/g, "$1@/components");

  if (replaced !== raw) {
    await fs.writeFile(file, replaced, "utf8");
    console.log(`normalized imports: ${path.relative(ROOT, file)}`);
  }
}

async function main() {
  try {
    // Skip silently if the source folder doesn't exist
    await fs.access(SOURCE_DIR).catch(() => null);
    for await (const file of walk(SOURCE_DIR)) {
      await normalizeFile(file);
    }
  } catch (err) {
    console.error("registry-normalize-imports failed:", err);
    process.exit(1);
  }
}

main();

