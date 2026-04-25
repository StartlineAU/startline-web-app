import type { Metadata } from "next";
import { Inter, Chakra_Petch } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets:  ["latin"],
  variable: "--font-inter",
});

const chakraPetch = Chakra_Petch({
  subsets:  ["latin"],
  weight:   ["400", "500", "600", "700"],
  variable: "--font-chakra-petch",
});

const SITE_URL = "https://www.startlineau.com";

export const metadata: Metadata = {
  // ── Canonical base (makes all relative OG image URLs absolute) ──
  metadataBase: new URL(SITE_URL),

  // ── Core ──
  title: {
    default:  "Startline — Find Fitness Events in Australia",
    template: "%s | Startline",
  },
  description:
    "Discover HYROX, CrossFit, running races and hybrid fitness events across Australia. Find, compare and register for competitions near you.",
  keywords: [
    "fitness events Australia",
    "HYROX Australia",
    "CrossFit competition",
    "running races",
    "hybrid fitness",
    "obstacle course",
    "fitness competition NSW VIC QLD",
  ],

  // ── Canonical ──
  alternates: {
    canonical: "/",
  },

  // ── OpenGraph ──
  openGraph: {
    type:        "website",
    siteName:    "Startline",
    title:       "Startline — Find Fitness Events in Australia",
    description:
      "Discover HYROX, CrossFit, running races and hybrid fitness events across Australia.",
    url:         SITE_URL,
    images: [
      {
        url:    "/site-preview.png",
        width:  1200,
        height: 630,
        alt:    "Startline — Australia's fitness event calendar",
      },
    ],
  },

  // ── Twitter / X ──
  twitter: {
    card:        "summary_large_image",
    title:       "Startline — Find Fitness Events in Australia",
    description: "Discover HYROX, CrossFit, running races and hybrid fitness events across Australia.",
    images:      ["/site-preview.png"],
  },

  // ── Favicons ──
  icons: {
    icon: [
      { url: "/images/logo.svg",                           type: "image/svg+xml" },
      { url: "/images/favicon_io/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/images/favicon_io/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/images/favicon_io/favicon.ico" },
    ],
    shortcut: "/images/logo.svg",
    apple:    "/images/favicon_io/apple-touch-icon.png",
  },

  // ── Robots directive ──
  robots: {
    index:            true,
    follow:           true,
    googleBot: {
      index:               true,
      follow:              true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet":       -1,
    },
  },

  // ── Verification (add your Search Console token here) ──
  // verification: {
  //   google: "YOUR_GOOGLE_SEARCH_CONSOLE_TOKEN",
  // },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body
        className={`${inter.variable} ${chakraPetch.variable} bg-dark-darker text-light font-sans antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
