import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
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
  ],
  experimental: {
    browserDebugInfoInTerminal: true,
  },
  webpack: (config) => {
    // Fix for packages importing `useShallow` from 'zustand/shallow'.
    // In Zustand v5 the hook lives under 'zustand/react/shallow'.
    config.resolve = config.resolve || {};
    config.resolve.alias = config.resolve.alias || {};
    config.resolve.alias["zustand/shallow"] = require.resolve(
      "zustand/react/shallow",
    );
    return config;
  },
};

export default nextConfig;
