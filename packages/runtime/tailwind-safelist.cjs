// Minimal runtime safelist for Tailwind. Import into your host tailwind.config.
// Example:
//   const runtimeSafelist = require('@formlink/runtime/tailwind-safelist.cjs')
//   module.exports = { safelist: [...(module.exports.safelist || []), ...runtimeSafelist] }

module.exports = [
  // Positioning used by desktop navigation
  'right-[12px]',
  'bottom-[12px]',
  // Layering for progress/nav
  'z-[100]',
  'z-[1000]',
];

