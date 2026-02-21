"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useState } from "react";
import { Menu, X, Sun, Moon } from "lucide-react";

type Theme = "light" | "dark";

export default function Header() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [theme, setTheme] = useState<Theme | null>(null);

  const applyTheme = (nextTheme: Theme) => {
    const root = document.documentElement;
    root.classList.add("theme-switching");
    root.classList.toggle("dark", nextTheme === "dark");
    root.style.colorScheme = nextTheme;
    localStorage.setItem("theme", nextTheme);
    setTheme(nextTheme);
    window.setTimeout(() => {
      root.classList.remove("theme-switching");
    }, 0);
  };
  const toggleTheme = () => {
    if (!theme) {
      return;
    }

    applyTheme(theme === "dark" ? "light" : "dark");
  };

  useEffect(() => {
    const rootTheme: Theme = document.documentElement.classList.contains("dark")
      ? "dark"
      : "light";
    setTheme(rootTheme);

    const storedTheme = localStorage.getItem("theme");
    if (storedTheme === "light" || storedTheme === "dark") {
      if (storedTheme !== rootTheme) {
        applyTheme(storedTheme);
      }
      return;
    }

    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const preferredTheme: Theme = prefersDark ? "dark" : "light";

    if (preferredTheme !== rootTheme) {
      applyTheme(preferredTheme);
      return;
    }

    localStorage.setItem("theme", preferredTheme);
  }, []);

  return (
    <header className="bg-dark-darker border-b border-dark-light sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-primary rounded flex items-center justify-center">
              <Image
                src="/images/startline-logo-dark-background_removed.png"
                alt="StartLine logo"
                width={32}
                height={32}
                className="hidden dark:block w-8 h-8"
              />
              <Image
                src="/images/startline-logo-light-background_removed.png"
                alt="StartLine logo"
                width={32}
                height={32}
                className="block dark:hidden w-8 h-8"
              />
            </div>
            <span className="text-xl font-bold text-light">StartingLine</span>
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
            <button
              type="button"
              onClick={toggleTheme}
              className="flex items-center justify-center bg-dark-light border border-dark-lighter p-2 rounded text-light hover:border-primary transition-colors"
              aria-label={
                theme
                  ? `Switch to ${theme === "dark" ? "light" : "dark"} theme`
                  : "Toggle theme"
              }
            >
              {theme === "dark" ? (
                <Sun className="w-4 h-4" />
              ) : theme === "light" ? (
                <Moon className="w-4 h-4" />
              ) : (
                <span className="w-4 h-4" aria-hidden="true" />
              )}
            </button>
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
          <nav className="md:hidden py-4 border-t border-dark-light animate-fade-in">
            <div className="flex flex-col space-y-3">
              <button
                type="button"
                onClick={toggleTheme}
                className="flex items-center justify-center w-full px-4 py-2 rounded bg-dark-light text-light hover:border-primary border border-dark-lighter transition-colors"
                aria-label={
                  theme
                    ? `Switch to ${theme === "dark" ? "light" : "dark"} theme`
                    : "Toggle theme"
                }
              >
                {theme === "dark" ? (
                  <Sun className="w-4 h-4" />
                ) : theme === "light" ? (
                  <Moon className="w-4 h-4" />
                ) : (
                  <span className="w-4 h-4" aria-hidden="true" />
                )}
              </button>
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
