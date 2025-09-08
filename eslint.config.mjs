// For more info, see https://github.com/storybookjs/eslint-plugin-storybook#configuration-flat-config-format
import storybook from "eslint-plugin-storybook";

export default [{
  ignores: [
    "**/node_modules/**",
    "**/dist/**",
    "**/.next/**",
    "**/build/**",
    "**/coverage/**",
    "**/.turbo/**",
  ],
}, ...storybook.configs["flat/recommended"]];