import type { KnipConfig } from "knip";

const config: KnipConfig = {
  workspaces: {
    ".": {
      entry: ["eslint.config.mjs"],
      ignoreDependencies: ["knip", "husky", "lint-staged", "@changesets/cli"],
    },
    "apps/formcraft": {
      entry: ["app/**/*.{ts,tsx}", "next.config.js"],
      ignoreDependencies: [
        // Build/dev tools
        "autoprefixer",
        "eslint",
        "eslint-config-next",
        "@eslint/eslintrc",
        "eslint-plugin-no-comments",
        "@tailwindcss/typography",
        "@types/lodash.debounce",
        "@types/styled-components",
        "jsdom",
        "vitest",
        "@vitejs/plugin-react",
      ],
    },
    "apps/formfiller": {
      entry: ["app/**/*.{ts,tsx}", "next.config.js"],
      ignoreDependencies: [
        // Build/dev tools
        "autoprefixer",
        "eslint",
        "eslint-config-next",
        "@eslint/eslintrc",
        "@tailwindcss/typography",
      ],
    },
    "packages/ui": {
      entry: ["src/index.ts", "src/**/*.tsx", "src/**/*.ts"],
      ignoreDependencies: [
        // Build/dev tools
        "eslint",
        "@tailwindcss/typography",
        "tailwindcss-animate",
      ],
    },
    "packages/db": {
      ignoreDependencies: ["eslint"],
    },
    "packages/schema": {
      ignoreDependencies: ["eslint"],
    },
    "packages/eslint-config": {},
    "packages/typescript-config": {},
    "apps/ui-docs": {},
  },
  // Ignore theme directory as requested
  ignore: ["packages/ui/src/theme/**/*"],
};

export default config;
