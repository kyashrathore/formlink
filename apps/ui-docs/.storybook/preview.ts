import { withThemeByClassName } from "@storybook/addon-themes";
import type { Preview } from "@storybook/nextjs";
import "../../../packages/ui/src/styles/globals.css"; // Adjust path if needed
// Runtime bundled CSS (layout/progress/navigation helpers)
import "@formlink/runtime/ui/react/style.css";

// Global fetch shim to ensure API calls from stories hit the real backend even inside Storybook.
// This avoids intermittent 404s when Next rewrites aren’t applied by the Storybook preview server.
(() => {
  if (typeof window === "undefined") return; // only patch in browser preview
  const BACKEND =
    (process.env.FORMLINK_BACKEND_ORIGIN as string) || "http://localhost:3001";
  const original = window.fetch.bind(window);
  window.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    try {
      const asString =
        typeof input === "string"
          ? input
          : String((input as any)?.url ?? input);
      // Skip absolute URLs (already explicit)
      if (/^https?:\/\//i.test(asString)) {
        return original(input as any, init);
      }
      // Resolve relative URL against current origin to inspect pathname
      const url = new URL(asString, window.location.origin);
      const path = url.pathname;

      // Normalize: redirect any '/api/chat' usage to chat-assist
      if (path === "/api/chat") {
        const dest = new URL("/api/ai/chat-assist" + url.search, BACKEND);
        return original(dest.toString(), init);
      }

      // Proxy critical backend endpoints directly to BACKEND to avoid missing rewrites
      if (
        path === "/api/ai/chat-assist" ||
        path === "/api/upload" ||
        path.startsWith("/api/forms/")
      ) {
        const dest = new URL(path + url.search, BACKEND);
        return original(dest.toString(), init);
      }
    } catch {
      // fall through
    }
    return original(input as any, init);
  }) as any;
})();

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
