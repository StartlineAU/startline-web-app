"use client";

import Link from "next/link";
import { useState } from "react";
import { Menu, X, Calendar, MapPin } from "lucide-react";

export default function Header() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  return (
    <header className="bg-dark text-white sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
              <Calendar className="w-5 h-5 text-dark" />
            </div>
            <span className="text-xl font-bold">StartingLine</span>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center space-x-8">
            <Link
              href="/"
              className="text-gray-300 hover:text-primary transition-colors duration-200"
            >
              Home
            </Link>
            <Link
              href="/events"
              className="text-gray-300 hover:text-primary transition-colors duration-200"
            >
              Events
            </Link>
            <Link
              href="/events"
              className="text-gray-300 hover:text-primary transition-colors duration-200"
            >
              Popular
            </Link>
            <Link
              href="/events"
              className="bg-primary text-dark px-4 py-2 rounded-lg font-medium hover:bg-primary-light transition-colors duration-200"
            >
              Find Events
            </Link>
          </nav>

          {/* Mobile menu button */}
          <button
            className="md:hidden p-2 rounded-lg hover:bg-dark-light transition-colors"
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            aria-label="Toggle menu"
          >
            {isMenuOpen ? (
              <X className="w-6 h-6" />
            ) : (
              <Menu className="w-6 h-6" />
            )}
          </button>
        </div>

        {/* Mobile Navigation */}
        {isMenuOpen && (
          <nav className="md:hidden py-4 border-t border-dark-light animate-fade-in">
            <div className="flex flex-col space-y-4">
              <Link
                href="/"
                className="text-gray-300 hover:text-primary transition-colors duration-200 py-2"
                onClick={() => setIsMenuOpen(false)}
              >
                Home
              </Link>
              <Link
                href="/events"
                className="text-gray-300 hover:text-primary transition-colors duration-200 py-2"
                onClick={() => setIsMenuOpen(false)}
              >
                Events
              </Link>
              <Link
                href="/events"
                className="text-gray-300 hover:text-primary transition-colors duration-200 py-2"
                onClick={() => setIsMenuOpen(false)}
              >
                Popular
              </Link>
              <Link
                href="/events"
                className="bg-primary text-dark px-4 py-2 rounded-lg font-medium hover:bg-primary-light transition-colors duration-200 text-center"
                onClick={() => setIsMenuOpen(false)}
              >
                Find Events
              </Link>
            </div>
          </nav>
        )}
      </div>
    </header>
  );
}
