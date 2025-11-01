import { withThemeByClassName } from "@storybook/addon-themes";
import type { Preview } from "@storybook/nextjs";
import "../../../packages/ui/src/styles/globals.css"; // Adjust path if needed
// Runtime bundled CSS (layout/progress/navigation helpers)
import "@formlink/runtime/ui/react/style.css";

const preview: Preview = {
  parameters: {
    layout: "fullscreen",
    actions: { argTypesRegex: "^on[A-Z].*" },
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/,
      },
    },
    darkMode: {
      classTarget: "html",
      stylePreview: true,
    },
    viewport: {
      viewports: {
        mobile1: {
          name: "Small mobile",
          styles: {
            width: "360px",
            height: "640px",
          },
        },
        mobile2: {
          name: "Large mobile",
          styles: {
            width: "414px",
            height: "896px",
          },
        },
        tablet: {
          name: "Tablet",
          styles: {
            width: "834px",
            height: "1194px",
          },
        },
      },
    },
  },
  decorators: [
    withThemeByClassName({
      themes: {
        light: "light",
        dark: "dark",
      },
      defaultTheme: "light",
    }),
  ],
};

export default preview;
