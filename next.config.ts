import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  // A package-lock.json under C:\Users\<you>\ makes Next pick the wrong workspace
  // root, which can make dev extremely slow or appear to hang on first load.
  outputFileTracingRoot: path.join(__dirname),
  turbopack: {
    root: path.join(__dirname),
  },

  // Required for absolute OG image URLs and canonical tags
  // Must match the production domain exactly (no trailing slash)
  experimental: {
    // metadataBase is set in layout.tsx but this is the canonical declaration
  },

  // Allow Google Maps iframe embeds
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "Content-Security-Policy",
            value: "frame-src 'self' https://www.google.com https://maps.googleapis.com;",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
