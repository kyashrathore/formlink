import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  assetPrefix: process.env.NODE_ENV === "production" ? "/f" : "",
  eslint: {
    ignoreDuringBuilds: true,
  },
  outputFileTracingRoot: path.join(__dirname, "../../"),
  transpilePackages: ["@formlink/ui", "@formlink/db", "@formlink/schema"],
  experimental: {
    browserDebugInfoInTerminal: true,
  },
};

export default nextConfig;
