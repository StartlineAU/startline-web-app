import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  // A package-lock.json under C:\Users\<you>\ makes Next pick the wrong workspace
  // root, which can make dev extremely slow or appear to hang on first load.
  outputFileTracingRoot: path.join(__dirname),
  output: "standalone",
  turbopack: {
    root: path.join(__dirname),
  },

  // Required for absolute OG image URLs and canonical tags
  // Must match the production domain exactly (no trailing slash)
  experimental: {
    // metadataBase is set in layout.tsx but this is the canonical declaration
  },

  // Allow Google Maps iframe embeds and Mapbox GL
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "Content-Security-Policy",
            value: [
              "frame-src 'self' https://www.google.com https://maps.googleapis.com",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://maps.googleapis.com https://maps.gstatic.com https://api.mapbox.com",
              "connect-src 'self' https://maps.googleapis.com https://maps.gstatic.com https://api.mapbox.com https://events.mapbox.com https://*.tiles.mapbox.com",
              "img-src 'self' data: blob: https://*.tiles.mapbox.com https://api.mapbox.com https://maps.googleapis.com https://maps.gstatic.com https:",
              "worker-src 'self' blob:",
              "style-src 'self' 'unsafe-inline' https://api.mapbox.com",
              "font-src 'self' data: https://api.mapbox.com",
            ].join("; "),
          },
        ],
      },
    ];
  },
};

export default nextConfig;
