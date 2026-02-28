import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "StartLine",
  description: "Discover local fitness events, classes, and activities in your area. From yoga to running, find the perfect workout for you.",
  icons: {
    icon: "/favicon.ico",
    shortcut: "/favicon.ico",
    apple: "/favicon.ico",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var storedTheme=localStorage.getItem("theme");var isDark=storedTheme?storedTheme==="dark":window.matchMedia("(prefers-color-scheme: dark)").matches;document.documentElement.classList.toggle("dark",isDark);document.documentElement.style.colorScheme=isDark?"dark":"light";}catch(e){}})();`,
          }}
        />
      </head>
      <body className={`${inter.variable} bg-dark-darker text-light font-sans antialiased transition-colors duration-200`}>
        <Header />
        <main className="min-h-screen">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
