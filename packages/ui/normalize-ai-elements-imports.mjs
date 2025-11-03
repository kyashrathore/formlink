#!/usr/bin/env node
/**
 * Normalize imports in src/components/ai-elements to use package-internal
 * relative paths instead of app-scoped aliases like "@/components/ui".
 *
 * - "@/components/ui/..." -> "../ui/..."
 * - "@/lib/utils"         -> "../lib/utils"
 * - "@/hooks/..."         -> "../hooks/..."
 *
 * Only touches files under src/components/ai-elements.
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.join(import.meta.dirname ?? path.dirname(new URL(import.meta.url).pathname)));
const TARGETS = [
  { dir: path.join(ROOT, 'src', 'components', 'ai-elements'), kind: 'ai-components' },
  { dir: path.join(ROOT, 'src', 'ui', 'ai-elements'), kind: 'ai-ui' },
  { dir: path.join(ROOT, 'src', 'components', 'ui'), kind: 'ui' },
  { dir: path.join(ROOT, 'src', 'components', 'kibo-ui'), kind: 'kibo' },
];

/** Recursively collect files under a directory */
function walk(dir) {
  if (!fs.existsSync(dir)) return [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) files.push(...walk(full));
    else if (/\.(ts|tsx|js|jsx)$/.test(e.name)) files.push(full);
  }
  return files;
}

function normalizeSource(src, kind) {
  // Preserve quote style by capturing it.
  let out = src;
  if (kind === 'ai-components') {
    // src/components/ai-elements -> src/components/ui and src/lib, src/hooks
    out = out.replace(/from\s+(["'])@\/components\/ui\//g, (m, q) => `from ${q}../ui/`);
    out = out.replace(/from\s+(["'])@\/components\/ui(["'])/g, (m, q1, q2) => `from ${q1}../ui${q2}`);
    out = out.replace(/from\s+(["'])@\/lib\/utils(["'])/g, (m, q1, q2) => `from ${q1}../../lib/utils${q2}`);
    out = out.replace(/from\s+(["'])@\/hooks\//g, (m, q) => `from ${q}../../hooks/`);
  } else if (kind === 'ai-ui') {
    // src/ui/ai-elements -> src/ui and src/lib, src/hooks
    out = out.replace(/from\s+(["'])@\/components\/ui\//g, (m, q) => `from ${q}../`);
    out = out.replace(/from\s+(["'])@\/components\/ui(["'])/g, (m, q1, q2) => `from ${q1}..${q2}`);
    out = out.replace(/from\s+(["'])@\/lib\/utils(["'])/g, (m, q1, q2) => `from ${q1}../lib/utils${q2}`);
    out = out.replace(/from\s+(["'])@\/hooks\//g, (m, q) => `from ${q}../hooks/`);
  } else if (kind === 'ui') {
    // src/components/ui -> same folder or src/lib
    out = out.replace(/from\s+(["'])@\/components\/ui\//g, (m, q) => `from ${q}./`);
    out = out.replace(/from\s+(["'])@\/components\/ui(["'])/g, (m, q1, q2) => `from ${q1}.${q2}`);
    out = out.replace(/from\s+(["'])@\/lib\/utils(["'])/g, (m, q1, q2) => `from ${q1}../../lib/utils${q2}`);
    // Fix previously normalized but incorrect depth
    out = out.replace(/from\s+(["'])\.\.\/lib\/utils(["'])/g, (m, q1, q2) => `from ${q1}../../lib/utils${q2}`);
  } else if (kind === 'kibo') {
    // src/components/kibo-ui -> needs to reach sibling components/ui and lib
    out = out.replace(/from\s+(["'])@\/components\/ui\//g, (m, q) => `from ${q}../../ui/`);
    out = out.replace(/from\s+(["'])@\/components\/ui(["'])/g, (m, q1, q2) => `from ${q1}../../ui${q2}`);
    out = out.replace(/from\s+(["'])@\/lib\/utils(["'])/g, (m, q1, q2) => `from ${q1}../../lib/utils${q2}`);
    // Fix previously normalized but incorrect depth for ui
    out = out.replace(/from\s+(["'])\.\.\/ui\//g, (m, q) => `from ${q}../../ui/`);
    out = out.replace(/from\s+(["'])\.\.\/ui(["'])/g, (m, q1, q2) => `from ${q1}../../ui${q2}`);
    // Fix accidental '../../components/ui' -> '../../ui'
    out = out.replace(/from\s+(["'])\.\.\/\.\.\/components\/ui\//g, (m, q) => `from ${q}../../ui/`);
    out = out.replace(/from\s+(["'])\.\.\/\.\.\/components\/ui(["'])/g, (m, q1, q2) => `from ${q1}../../ui${q2}`);
  }
  return out;
}

function main() {
  let changed = 0;
  for (const { dir, kind } of TARGETS) {
    const files = walk(dir);
    if (!files.length) {
      console.log(`No files found under ${dir}`);
      continue;
    }
    for (const file of files) {
      const orig = fs.readFileSync(file, 'utf8');
      const next = normalizeSource(orig, kind);
      if (next !== orig) {
        fs.writeFileSync(file, next, 'utf8');
        console.log(`updated ${path.relative(ROOT, file)}`);
        changed++;
      }
    }
  }

  // Global pass: rewrite relative "../..../ui/..." to "../..../components/ui/..." outside components/ui itself
  const ALL_FILES = walk(path.join(ROOT, 'src'));
  for (const file of ALL_FILES) {
    // Skip files inside the canonical destinations
    if (file.includes(path.join('src', 'components'))) continue; // skip all components/* (ui, ai-elements, kibo-ui, etc.)
    let text = fs.readFileSync(file, 'utf8');
    let next = text
      .replace(/from\s+(["'])((?:\.\.\/)+)ui\//g, (m, q, rel) => `from ${q}${rel}components/ui/`)
      .replace(/from\s+(["'])((?:\.\.\/)+)ui(["'])/g, (m, q1, rel, q2) => `from ${q1}${rel}components/ui${q2}`)
      // Special: src/ui/feedback/* importing ../button etc -> route to components/ui
      .replace(/(src\/ui\/feedback\/.*)/, "$1")
      .replace(/from\s+(["'])\.\.\/([A-Za-z-]+)(["'])/g, (m, q1, name, q2) => {
        // Only apply within feedback directory
        if (!file.includes(path.join('src', 'ui', 'feedback'))) return m;
        return `from ${q1}../../components/ui/${name}${q2}`;
      })
      // Fix form imports of kibo: ../../../ui/kibo-ui/... -> ../../../components/kibo-ui/...
      .replace(/from\s+(["'])((?:\.\.\/)+)components\/ui\/kibo-ui\//g, (m, q, rel) => `from ${q}${rel}components/kibo-ui/`);

    // Replace @formlink/ui/lib/utils with appropriate relative path by location
    if (next.includes('@formlink/ui/lib/utils')) {
      const rel = file.includes(path.join('src', 'components'))
        ? '../../lib/utils'
        : file.includes(path.join('src', 'form'))
          ? '../../lib/utils'
          : file.includes(path.join('src', 'motion'))
            ? '../lib/utils'
            : '../lib/utils';
      next = next.replace(/from\s+(["'])@formlink\/ui\/lib\/utils(["'])/g, (m, q1, q2) => `from ${q1}${rel}${q2}`);
    }
    // Fix feedback utils depth: ../lib/utils -> ../../lib/utils
    if (file.includes(path.join('src', 'ui', 'feedback'))) {
      next = next.replace(/from\s+(["'])\.\.\/lib\/utils(["'])/g, (m, q1, q2) => `from ${q1}../../lib/utils${q2}`);
    }

    if (next !== text) {
      fs.writeFileSync(file, next, 'utf8');
      console.log(`updated ${path.relative(ROOT, file)}`);
      changed++;
    }
  }
  console.log(`done. files changed: ${changed}`);
}

main();
