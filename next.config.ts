import type { NextConfig } from "next";
import path from "path";

const isProduction = process.env.NODE_ENV === "production";

function hostOf(url: string | undefined): string | null {
  if (!url) return null;
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}

// The uploads bucket and its CDN, known at build time: Next loads the env files
// (including the .env.production preBuild writes) before reading this config,
// and UPLOADS_BUCKET is a branch variable the build sees. When they are known,
// the CSP and the image optimiser allow those hosts only, not every bucket in
// the region or every CloudFront distribution.
const uploadsBucket = process.env.AWS_S3_BUCKET || process.env.UPLOADS_BUCKET || "";
const uploadsRegion = process.env.AWS_S3_REGION || process.env.AWS_REGION || "ap-southeast-2";
const uploadsCdnHosts = [
  "cdn.startlineau.com",
  hostOf(process.env.NEXT_PUBLIC_CDN_URL),
  hostOf(process.env.CDN_URL),
].filter((host, index, all): host is string => Boolean(host) && all.indexOf(host) === index);

const bucketHosts = uploadsBucket
  ? [`${uploadsBucket}.s3.${uploadsRegion}.amazonaws.com`, `${uploadsBucket}.s3.amazonaws.com`]
  : [];

const nextConfig: NextConfig = {
  ...(process.env.CI || process.env.PLAYWRIGHT ? { devIndicators: { buildActivity: false } } : {}),
  serverExternalPackages: ["pg", "exceljs", "@react-pdf/renderer"],
  transpilePackages: ["maplibre-gl"],
  // A package-lock.json under C:\Users\<you>\ makes Next pick the wrong workspace
  // root, which can make dev extremely slow or appear to hang on first load.
  outputFileTracingRoot: path.join(__dirname),
  output: "standalone",
  poweredByHeader: false,
  // pdfkit picks its built-in PDF fonts with a computed require, so Next's file
  // tracer cannot see `js/standard-fonts/*.cjs`. The standalone output Amplify
  // runs then threw MODULE_NOT_FOUND for Helvetica.cjs and every server-rendered
  // PDF failed to download: check-in QR poster and start-list export (#473).
  outputFileTracingIncludes: {
    "/*": ["./node_modules/.pnpm/pdfkit@*/node_modules/pdfkit/js/**/*"],
  },
  turbopack: {
    root: path.join(__dirname),
  },

  // Middleware runs on the Edge runtime, where an arbitrary `process.env` read is
  // not guaranteed to see the server's environment — the production build leaves
  // `process.env.PUBLIC_SITE_MODE` as a runtime lookup. Listing it here makes
  // Next inline the value at build time, so the waitlist gate behaves the same in
  // dev, `next start` and Amplify. The Amplify preBuild writes `.env.production`
  // from the app secret before `next build`, so a deploy's value is the one that
  // gets inlined; changing it needs a rebuild, not just a restart.
  //
  // Not a secret: it is either "waitlist" or "live". Defaulting here to the
  // closed value means a build with the variable missing cannot open the site.
  env: {
    PUBLIC_SITE_MODE: process.env.PUBLIC_SITE_MODE ?? "waitlist",
  },

  images: {
    // The optimiser fetches whatever these patterns allow, so they name our own
    // CDN and bucket. The wildcards remain only for a build that does not know
    // its bucket, which is local development.
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com" },
      ...uploadsCdnHosts.map((hostname) => ({ protocol: "https" as const, hostname, pathname: "/uploads/**" })),
      ...(bucketHosts.length > 0
        ? bucketHosts.map((hostname) => ({ protocol: "https" as const, hostname, pathname: "/uploads/**" }))
        : [
            { protocol: "https" as const, hostname: "*.cloudfront.net", pathname: "/uploads/**" },
            { protocol: "https" as const, hostname: "*.s3.ap-southeast-2.amazonaws.com", pathname: "/uploads/**" },
          ]),
      ...(isProduction ? [] : [{ protocol: "http" as const, hostname: "localhost", port: "3000", pathname: "/uploads/**" }]),
    ],
  },

  async headers() {
    // Dev needs 'unsafe-eval' for React Fast Refresh. Production drops it so
    // script-src can actually block injected code. A strict nonce CSP is
    // tracked as a post-MVP issue.
    const scriptSrc =
      isProduction
        ? "'self' 'unsafe-inline' https://js.stripe.com https://api.mapbox.com https://challenges.cloudflare.com"
        : "'self' 'unsafe-inline' 'unsafe-eval' https://js.stripe.com https://api.mapbox.com https://challenges.cloudflare.com";

    // After a Google or Apple sign-in the browser POSTs the authorization code
    // to our Cognito hosted domain, which connect-src has to allow or the
    // callback hangs with no server-side trace. Deployed environments use
    // their own domain (auth.startlineau.com, auth-staging.startlineau.com) and
    // local dev shares staging's, while the e2e suite uses an amazoncognito.com
    // host, so both are allowed. The custom host comes from the same variable
    // the app builds its OAuth config from rather than being spelled out here,
    // where it drifts.
    const cognitoDomain = process.env.NEXT_PUBLIC_COGNITO_DOMAIN;
    const cognitoConnectSrc = [
      "https://*.auth.ap-southeast-2.amazoncognito.com",
      ...(cognitoDomain ? [`https://${cognitoDomain}`] : []),
    ].join(" ");
    // Presigned uploads POST straight to the bucket. Its own host when known;
    // otherwise (a local build with no bucket) any bucket in the region.
    const uploadConnectSrc = bucketHosts.length > 0
      ? bucketHosts.map((host) => `https://${host}`).join(" ")
      : "https://*.s3.ap-southeast-2.amazonaws.com https://*.s3.amazonaws.com";
    // The native shell (capacitor://) talks to the site from its own origin.
    // localhost is for local development only.
    const extraConnectSrc = isProduction ? "capacitor://" : "capacitor:// http://localhost";

    return [
      {
        source: "/(.*)",
        headers: [
          // Pages are never framed, so they cannot be overlaid to trick a click
          // (approve, refund, delete). frame-ancestors below says the same to
          // browsers that read CSP.
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(self), geolocation=(self), microphone=(), payment=(self \"https://js.stripe.com\")" },
          ...(isProduction
            ? [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" }]
            : []),
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              "object-src 'none'",
              "base-uri 'self'",
              "form-action 'self'",
              "frame-ancestors 'none'",
              "frame-src 'self' https://js.stripe.com https://hooks.stripe.com https://challenges.cloudflare.com",
              `script-src ${scriptSrc}`,
              // The S3 origin is required: uploads POST straight to a presigned
              // bucket URL rather than through /api/upload, because Amplify's
              // compute runtime rejects a multipart body over roughly 4.4 MB.
              // Without it the browser blocks the upload with no server-side trace.
              "connect-src 'self' https://js.stripe.com https://api.mapbox.com https://events.mapbox.com https://*.tiles.mapbox.com https://challenges.cloudflare.com https://cognito-idp.ap-southeast-2.amazonaws.com " + cognitoConnectSrc + " " + uploadConnectSrc + " " + extraConnectSrc,
              "img-src 'self' data: blob: https://*.tiles.mapbox.com https://api.mapbox.com https:",
              "worker-src blob: 'self'",
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
