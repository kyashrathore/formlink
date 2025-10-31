// Import the UI package's tailwind config or create a similar one
const uiConfig = require("../../packages/ui/tailwind.config.js");

/** @type {import('tailwindcss').Config} */
module.exports = {
  ...uiConfig,
  content: [
    ...(uiConfig.content || []),
    "./stories/**/*.{js,ts,jsx,tsx,mdx}",
    "../../packages/ui/src/**/*.{js,ts,jsx,tsx}",
    // Ensure runtime UI classes are generated (used directly by stories)
    "../../packages/runtime/src/**/*.{js,ts,jsx,tsx}",
  ],
  safelist: [
    // Arbitrary values used in runtime components
    "bottom-[12px]",
    "z-[1000]",
    "z-[100]",
  ],
};
