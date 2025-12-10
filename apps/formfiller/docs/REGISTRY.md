Local Registry Build Notes

- Source imports must use the app alias: "@/components/...". Do not author imports as "@formlink/ui/components/..." in files that are part of the registry build inputs.
- Before running shadcn registry:build, run our normalizer to rewrite any stray "@formlink/ui/components" to "@/components".

Usage

- Build all registry JSON files into public/r:
  - pnpm run registry:build
  - This runs scripts/registry-normalize-imports.mjs first, then shadcn registry:build ./registry.json -o ./public/r --verbose

Why

- shadcn’s import rewrite logic expects "@/…" in template sources. If sources contain "@formlink/ui/components", the builder may infer multiple roots, leading to duplicate component files during install.
- Normalizing to "@/components" ensures the builder rewrites consistently using the configured components alias and avoids duplicates.
