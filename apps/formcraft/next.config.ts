import path from "path"
import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  outputFileTracingRoot: path.join(__dirname, "../../"),
  transpilePackages: ["@formlink/ui", "@formlink/db", "@formlink/schema"],
  devIndicators: {
    position: "top-right",
  },
  experimental: {
    viewTransition: true,
    browserDebugInfoInTerminal: true,
  },
  async headers() {
    return [
      {
        source: "/:path*",
        has: [
          {
            type: "host",
            value: "formjunction-formcraft.vercel.app",
          },
        ],
        headers: [
          {
            key: "X-Robots-Tag",
            value: "noindex",
          },
        ],
      },
    ]
  },
}

export default nextConfig
