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
};

export default nextConfig;
