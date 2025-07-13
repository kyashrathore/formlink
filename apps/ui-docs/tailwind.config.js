// Import the UI package's tailwind config or create a similar one
const uiConfig = require('../../packages/ui/tailwind.config.js');

/** @type {import('tailwindcss').Config} */
module.exports = {
  ...uiConfig,
  content: [
    ...uiConfig.content || [],
    './stories/**/*.{js,ts,jsx,tsx,mdx}',
    '../../packages/ui/src/**/*.{js,ts,jsx,tsx}'
  ],
};
