import Link from "next/link";
import { Calendar, Mail, MapPin, Phone } from "lucide-react";

export default function Footer() {
  return (
    <footer className="bg-dark text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Brand */}
          <div className="col-span-1 md:col-span-2">
            <Link href="/" className="flex items-center space-x-2 mb-4">
              <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
                <Calendar className="w-5 h-5 text-dark" />
              </div>
              <span className="text-xl font-bold">StartingLine</span>
            </Link>
            <p className="text-muted max-w-md">
              Discover fitness events near you. From yoga to marathons, find the
              perfect activity to keep you moving and motivated.
            </p>
          </div>

          {/* Quick Links */}
          <div>
            <h3 className="text-lg font-semibold mb-4">Quick Links</h3>
            <ul className="space-y-2">
              <li>
                <Link
                  href="/"
                  className="text-muted hover:text-primary transition-colors"
                >
                  Home
                </Link>
              </li>
              <li>
                <Link
                  href="/events"
                  className="text-muted hover:text-primary transition-colors"
                >
                  Browse Events
                </Link>
              </li>
              <li>
                <Link
                  href="/events"
                  className="text-muted hover:text-primary transition-colors"
                >
                  Popular Now
                </Link>
              </li>
              <li>
                <Link
                  href="/events"
                  className="text-muted hover:text-primary transition-colors"
                >
                  Near Me
                </Link>
              </li>
            </ul>
          </div>

          {/* Event Types */}
          <div>
            <h3 className="text-lg font-semibold mb-4">Event Types</h3>
            <ul className="space-y-2">
              <li>
                <Link
                  href="/events"
                  className="text-muted hover:text-primary transition-colors"
                >
                  Running
                </Link>
              </li>
              <li>
                <Link
                  href="/events"
                  className="text-muted hover:text-primary transition-colors"
                >
                  Yoga
                </Link>
              </li>
              <li>
                <Link
                  href="/events"
                  className="text-muted hover:text-primary transition-colors"
                >
                  Cycling
                </Link>
              </li>
              <li>
                <Link
                  href="/events"
                  className="text-muted hover:text-primary transition-colors"
                >
                  HIIT & CrossFit
                </Link>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="border-t border-dark-light mt-8 pt-8 flex flex-col md:flex-row justify-between items-center">
          <p className="text-muted text-sm">
            © {new Date().getFullYear()} StartingLine. All rights reserved.
          </p>
          <div className="flex space-x-6 mt-4 md:mt-0">
            <Link
              href="#"
              className="text-muted hover:text-primary text-sm transition-colors"
            >
              Privacy Policy
            </Link>
            <Link
              href="#"
              className="text-muted hover:text-primary text-sm transition-colors"
            >
              Terms of Service
            </Link>
            <Link
              href="#"
              className="text-muted hover:text-primary text-sm transition-colors"
            >
              Contact
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
