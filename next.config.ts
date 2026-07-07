import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  serverExternalPackages: ["pg"],
  transpilePackages: ["maplibre-gl"],
  // A package-lock.json under C:\Users\<you>\ makes Next pick the wrong workspace
  // root, which can make dev extremely slow or appear to hang on first load.
  outputFileTracingRoot: path.join(__dirname),
  output: "standalone",
  turbopack: {
    root: path.join(__dirname),
  },

  images: {
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "*.s3.ap-southeast-2.amazonaws.com", pathname: "/uploads/**" },
      { protocol: "http", hostname: "localhost", port: "3000", pathname: "/uploads/**" },
    ],
  },

  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "Content-Security-Policy",
            value: "worker-src blob: 'self';",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
