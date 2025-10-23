import { defineConfig } from "tsup";

export default defineConfig({
  entry: [
    "src/index.ts",
    "src/ui/react/index.ts",
    "src/devtools/Devtools.tsx",
    "src/schema/index.ts",
  ],
  format: ["esm"],
  dts: true,
  dtsResolve: true,
  sourcemap: true,
  splitting: false,
  clean: true,
  target: "es2022",
  platform: "browser",
  external: [
    "react",
    "react-dom",
    "motion",
    "@tanstack/form-core",
    "@tanstack/react-form",
    "@tanstack/zod-form-adapter",
    "@dnd-kit/core",
    "@dnd-kit/sortable",
    "@dnd-kit/utilities",
    "libphonenumber-js",
  ],
  noExternal: ["@formlink/schema"],
});
