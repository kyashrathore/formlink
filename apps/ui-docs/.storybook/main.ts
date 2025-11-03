import type { StorybookConfig } from "@storybook/nextjs";
import { createRequire } from "node:module";
import path, { dirname, join } from "path";

const require = createRequire(import.meta.url);

const config: StorybookConfig = {
  stories: [
    "../stories/**/*.mdx",
    "../stories/**/*.stories.@(js|jsx|mjs|ts|tsx)",
    "../../../packages/ui/src/**/*.stories.@(js|jsx|mjs|ts|tsx)",
  ],
  addons: [
    getAbsolutePath("@storybook/addon-links"),
    getAbsolutePath("@storybook/addon-a11y"),
    getAbsolutePath("@storybook/addon-docs"),
  ],
  framework: {
    name: getAbsolutePath("@storybook/nextjs"),
    options: {
      nextConfigPath: path.resolve(__dirname, "../next.config.mjs"),
    },
  },
  docs: {
    defaultName: "Documentation",
  },
  typescript: {
    check: false,
    reactDocgen: "react-docgen-typescript",
    reactDocgenTypescriptOptions: {
      shouldExtractLiteralValuesFromEnum: true,
      propFilter: (prop) =>
        prop.parent ? !/node_modules/.test(prop.parent.fileName) : true,
    },
  },
  webpackFinal: async (config) => {
    if (config.resolve) {
      config.resolve.alias = {
        ...config.resolve.alias,
        "@": path.resolve(
          __dirname,
          "../",
          "../",
          "../",
          "packages",
          "ui",
          "src",
        ),
      };
      config.resolve.extensions = [
        ".ts",
        ".tsx",
        ".js",
        ".jsx",
        ".mjs",
        ...(config.resolve.extensions || []),
      ];
      config.resolve.conditionNames = [
        "source",
        ...(config.resolve.conditionNames ?? []),
      ];
    }
    // Transpile TS sources from eventsource-parser used by @ai-sdk/react in Storybook
    if (config.module) {
      const rules = config.module.rules || [];
      rules.push({
        test: /node_modules[\\/](eventsource-parser)[\\/]src[\\/].+\.ts$/,
        use: [
          {
            loader: require.resolve("babel-loader"),
            options: {
              presets: [require.resolve("next/babel")],
            },
          },
        ],
      });
      config.module.rules = rules;
    }
    return config;
  },
};

export default config;

function getAbsolutePath(value: string): any {
  return dirname(require.resolve(join(value, "package.json")));
}
