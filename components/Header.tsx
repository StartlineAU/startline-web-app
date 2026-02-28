"use client";

import Link from "next/link";
import Image from "next/image";
import { useState } from "react";
import { Menu, X } from "lucide-react";

export default function Header() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  return (
    <header className="bg-dark-darker border-b border-dark-light sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-3">
            <Image
              src="/images/logo.png"
              alt="StartLine logo mark"
              width={526}
              height={156}
              className="h-8 w-auto object-contain shrink-0"
              unoptimized
              priority
            />
            <Image
              src="/images/startline-title-white.png"
              alt="StartLine"
              width={140}
              height={28}
              className="h-6 w-auto"
              priority
            />
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center space-x-8 font-title font-bold">
            <Link
              href="/events"
              className="text-muted hover:text-primary transition-colors duration-200 text-sm"
            >
              All Competitions
            </Link>
            <Link
              href="/events?type=hyrox"
              className="text-muted hover:text-primary transition-colors duration-200 text-sm"
            >
              HYROX
            </Link>
            <Link
              href="/events?type=crossfit"
              className="text-muted hover:text-primary transition-colors duration-200 text-sm"
            >
              CrossFit
            </Link>
            <Link
              href="/events?type=running"
              className="text-muted hover:text-primary transition-colors duration-200 text-sm"
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
              <X className="w-6 h-6 text-light" />
            ) : (
              <Menu className="w-6 h-6 text-light" />
            )}
          </button>
        </div>

        {/* Mobile Navigation */}
        {isMenuOpen && (
          <nav className="md:hidden py-4 border-t border-dark-light animate-fade-in font-title font-bold">
            <div className="flex flex-col space-y-3">
              <Link
                href="/events"
                className="text-muted hover:text-primary transition-colors duration-200 py-2"
                onClick={() => setIsMenuOpen(false)}
              >
                All Competitions
              </Link>
              <Link
                href="/events?type=hyrox"
                className="text-muted hover:text-primary transition-colors duration-200 py-2"
                onClick={() => setIsMenuOpen(false)}
              >
                HYROX
              </Link>
              <Link
                href="/events?type=crossfit"
                className="text-muted hover:text-primary transition-colors duration-200 py-2"
                onClick={() => setIsMenuOpen(false)}
              >
                CrossFit
              </Link>
              <Link
                href="/events?type=running"
                className="text-muted hover:text-primary transition-colors duration-200 py-2"
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
