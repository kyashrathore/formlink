import fs from "node:fs/promises";
import path from "node:path";
import url from "node:url";

export type LoadPromptOptions = {
  pretty?: number | false;
  strict?: boolean;
};

const CACHE = new Map<string, string>();
let GUARDS_CACHE: string | null = null;
let REFUSAL_CACHE: string | null = null;

function pkgRootDir() {
  // packages/prompts/src -> packages/prompts
  return path.dirname(path.dirname(url.fileURLToPath(import.meta.url)));
}

function resolveIdToFile(idOrPath: string): string {
  // Normalize id → packages/prompts/md/<id>.md
  const id = idOrPath.replace(/^\//, "");
  const withExt = id.endsWith(".md") ? id : `${id}.md`;
  // If caller passed a relative path containing md/, honor it verbatim under package root
  const candidate = path.resolve(pkgRootDir(), "md", withExt);
  return candidate;
}

async function readTemplate(filePath: string): Promise<string> {
  const cached = CACHE.get(filePath);
  if (cached) return cached;
  const data = await fs.readFile(filePath, "utf8");
  CACHE.set(filePath, data);
  return data;
}

function isObjectLike(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === "object";
}

export function stableStringify(value: unknown, space: number | undefined = 2) {
  const seen = new WeakSet();
  const normalize = (v: any): any => {
    if (v === null || typeof v !== "object") return v;
    if (seen.has(v)) return undefined;
    seen.add(v);
    if (Array.isArray(v)) return v.map(normalize);
    const out: Record<string, any> = {};
    for (const key of Object.keys(v).sort()) out[key] = normalize(v[key]);
    return out;
  };
  return JSON.stringify(normalize(value), undefined, space);
}

function renderTemplateString(
  template: string,
  params: Record<string, unknown>,
  options: LoadPromptOptions,
): string {
  const pretty = options.pretty === false ? undefined : (options.pretty ?? 2);
  const strict = options.strict !== false;

  // Mask fenced code blocks and inline code to avoid replacing examples like `{{answer:Q}}`
  const codeFences: string[] = [];
  const inlineCodes: string[] = [];
  let masked = template;
  // Fenced blocks ``` ... ```
  masked = masked.replace(/```[\s\S]*?```/g, (m) => {
    const idx = codeFences.push(m) - 1;
    return `__CODE_FENCE_${idx}__`;
  });
  // Inline code `...`
  masked = masked.replace(/`[^`]*`/g, (m) => {
    const idx = inlineCodes.push(m) - 1;
    return `__CODE_INLINE_${idx}__`;
  });

  // Extract placeholders like {{ var }} (no nesting/logic, plain names only)
  const placeholderRe = /{{\s*([a-zA-Z0-9_]+)\s*}}/g;
  const usedKeys = new Set<string>();
  const missing = new Set<string>();

  let rendered = masked.replace(placeholderRe, (_, rawKey: string) => {
    usedKeys.add(rawKey);
    if (!(rawKey in params)) {
      missing.add(rawKey);
      return strict ? `{{MISSING:${rawKey}}}` : "";
    }
    const val = (params as any)[rawKey];
    if (typeof val === "string") return val;
    if (typeof val === "number" || typeof val === "boolean") return String(val);
    return stableStringify(val, pretty as number | undefined);
  });

  // Restore inline and fenced code blocks
  rendered = rendered
    .replace(/__CODE_INLINE_(\d+)__/g, (_, i) => inlineCodes[Number(i)] || "")
    .replace(/__CODE_FENCE_(\d+)__/g, (_, i) => codeFences[Number(i)] || "");

  if (strict && missing.size) {
    throw new Error(
      `loadPrompt: missing variables: ${Array.from(missing).join(", ")}`,
    );
  }

  // Dev-only warning for extra params not used in template
  if (process.env.NODE_ENV !== "production") {
    const extras = Object.keys(params).filter((k) => !usedKeys.has(k));
    if (extras.length) {
      // eslint-disable-next-line no-console
      console.warn(
        `[prompts] Unused params for template: ${extras.join(", ")}`,
      );
    }
  }

  return rendered;
}

export async function loadPrompt(
  idOrPath: string,
  params: Record<string, unknown> = {},
  options: LoadPromptOptions = {},
): Promise<string> {
  const filePath = resolveIdToFile(idOrPath);
  const template = await readTemplate(filePath);
  // Ensure guards variable is available by default
  try {
    if (!GUARDS_CACHE) {
      const guardsPath = resolveIdToFile("_guards.md");
      GUARDS_CACHE = await readTemplate(guardsPath);
    }
    if (!REFUSAL_CACHE) {
      const refusalPath = resolveIdToFile("_refusal.md");
      REFUSAL_CACHE = await readTemplate(refusalPath);
    }
  } catch {
    if (!GUARDS_CACHE) GUARDS_CACHE = "";
    if (!REFUSAL_CACHE) REFUSAL_CACHE = "";
  }
  const withGuards = {
    guards: GUARDS_CACHE,
    refusal: REFUSAL_CACHE,
    ...params,
  };
  return renderTemplateString(template, withGuards, options);
}

export function resolvePromptPath(idOrPath: string): string {
  return resolveIdToFile(idOrPath);
}
