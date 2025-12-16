import path from "path"

const nextConfig = {
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
  devIndicators: {
    position: "bottom-left",
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
