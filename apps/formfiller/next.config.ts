import path from "path";

const nextConfig = {
  assetPrefix: process.env.NODE_ENV === "production" ? "/f" : "",
  eslint: {
    ignoreDuringBuilds: true,
  },
  outputFileTracingRoot: path.join(__dirname, "../../"),
  transpilePackages: [
    "@formlink/ui",
    "@formlink/db",
    "@formlink/schema",
    "@formlink/prompts",
    "@formlink/runtime",
    "use-sync-external-store",
    "@xyflow/react",
  ],
  experimental: {
    browserDebugInfoInTerminal: true,
  },
  webpack: (config: any) => {
    // Ensure alias map exists
    config.resolve = config.resolve || {};
    config.resolve.alias = config.resolve.alias || {};
    // Note: no alias for `zustand/shallow` — zustand v5 still exports `shallow` via
    // `zustand/shallow` (ESM and CJS). Aliasing to `zustand/react/shallow` breaks
    // libraries (e.g., @xyflow/react) that expect the `shallow` comparator export.
    //
    // Also avoid hard-mapping @formlink/runtime to local dist; rely on package exports
    // so the package is consumable externally without workspace-specific aliases.
    return config;
  },
};

export default nextConfig;
