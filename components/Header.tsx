"use client";

import Link from "next/link";
import { useState } from "react";
import { Menu, X, Flag } from "lucide-react";

export default function Header() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  return (
    <header className="bg-dark-darker border-b border-dark-light sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-primary rounded flex items-center justify-center">
              <Flag className="w-4 h-4 text-dark" />
            </div>
            <span className="text-xl font-bold text-white">StartingLine</span>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center space-x-8">
            <Link
              href="/events"
              className="text-muted hover:text-primary transition-colors duration-200 text-sm font-medium"
            >
              All Competitions
            </Link>
            <Link
              href="/events?type=hyrox"
              className="text-muted hover:text-primary transition-colors duration-200 text-sm font-medium"
            >
              HYROX
            </Link>
            <Link
              href="/events?type=crossfit"
              className="text-muted hover:text-primary transition-colors duration-200 text-sm font-medium"
            >
              CrossFit
            </Link>
            <Link
              href="/events?type=running"
              className="text-muted hover:text-primary transition-colors duration-200 text-sm font-medium"
            >
              Running
            </Link>
            <Link
              href="/events"
              className="bg-primary text-dark px-4 py-2 rounded font-semibold text-sm hover:bg-primary-light transition-colors duration-200"
            >
              Find Competitions
            </Link>
          </nav>

          {/* Mobile menu button */}
          <button
            className="md:hidden p-2 rounded hover:bg-dark-light transition-colors"
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            aria-label="Toggle menu"
          >
            {isMenuOpen ? (
              <X className="w-6 h-6 text-white" />
            ) : (
              <Menu className="w-6 h-6 text-white" />
            )}
          </button>
        </div>

        {/* Mobile Navigation */}
        {isMenuOpen && (
          <nav className="md:hidden py-4 border-t border-dark-light animate-fade-in">
            <div className="flex flex-col space-y-3">
              <Link
                href="/events"
                className="text-muted hover:text-primary transition-colors duration-200 py-2 font-medium"
                onClick={() => setIsMenuOpen(false)}
              >
                All Competitions
              </Link>
              <Link
                href="/events?type=hyrox"
                className="text-muted hover:text-primary transition-colors duration-200 py-2 font-medium"
                onClick={() => setIsMenuOpen(false)}
              >
                HYROX
              </Link>
              <Link
                href="/events?type=crossfit"
                className="text-muted hover:text-primary transition-colors duration-200 py-2 font-medium"
                onClick={() => setIsMenuOpen(false)}
              >
                CrossFit
              </Link>
              <Link
                href="/events?type=running"
                className="text-muted hover:text-primary transition-colors duration-200 py-2 font-medium"
                onClick={() => setIsMenuOpen(false)}
              >
                Running
              </Link>
              <Link
                href="/events"
                className="bg-primary text-dark px-4 py-3 rounded font-semibold text-center hover:bg-primary-light transition-colors duration-200 mt-2"
                onClick={() => setIsMenuOpen(false)}
              >
                Find Competitions
              </Link>
            </div>
          </nav>
        )}
      </div>
    </header>
  );
}
