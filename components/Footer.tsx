import Link from "next/link";
import { Flag } from "lucide-react";

export default function Footer() {
  return (
    <footer className="bg-dark-darker border-t border-dark-light">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          {/* Brand */}
          <div className="flex items-center gap-6">
            <Link href="/" className="flex items-center gap-2">
              <div className="w-8 h-8 bg-primary rounded flex items-center justify-center">
                <Flag className="w-4 h-4 text-dark" />
              </div>
              <span className="text-lg font-bold text-white">StartingLine</span>
            </Link>
            <span className="hidden md:inline text-muted text-sm">
              Australia&apos;s Competitive Fitness Calendar
            </span>
          </div>

          {/* Links */}
          <div className="flex items-center gap-6">
            <Link
              href="/events"
              className="text-sm text-muted hover:text-primary transition-colors"
            >
              All Competitions
            </Link>
            <Link
              href="/submit"
              className="text-sm text-muted hover:text-primary transition-colors"
            >
              Submit Event
            </Link>
            <Link
              href="/about"
              className="text-sm text-muted hover:text-primary transition-colors"
            >
              About
            </Link>
            <Link
              href="/contact"
              className="text-sm text-muted hover:text-primary transition-colors"
            >
              Contact
            </Link>
          </div>
        </div>

        {/* Copyright */}
        <div className="mt-8 pt-6 border-t border-dark-light text-center md:text-left">
          <p className="text-sm text-muted-dark">
            © {new Date().getFullYear()} StartingLine. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
