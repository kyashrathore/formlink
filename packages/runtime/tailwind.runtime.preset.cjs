const path = require("path");

const runtimeSafelist = require("./tailwind-safelist.cjs");

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    path.join(__dirname, "dist/ui/react/**/*.{js,mjs,cjs}"),
    path.join(__dirname, "src/ui/react/**/*.{ts,tsx}"),
  ],
  safelist: runtimeSafelist,
  theme: {
    extend: {},
  },
  plugins: [require("tailwindcss-animate")],
};
