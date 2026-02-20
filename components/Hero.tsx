"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Search, MapPin, ArrowRight } from "lucide-react";

export default function Hero() {
  const [searchLocation, setSearchLocation] = useState("");
  const router = useRouter();

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchLocation.trim()) {
      router.push(`/events?area=${encodeURIComponent(searchLocation.trim())}`);
    } else {
      router.push("/events");
    }
  };

  return (
    <section className="relative bg-dark overflow-hidden">
      {/* Background Image Placeholder */}
      <div className="absolute inset-0 image-placeholder opacity-20">
        <div className="absolute inset-0 bg-gradient-to-r from-dark via-dark/80 to-transparent" />
      </div>

      {/* Decorative Elements */}
      <div className="absolute top-20 right-10 w-64 h-64 bg-primary/10 rounded-full blur-3xl" />
      <div className="absolute bottom-10 left-10 w-48 h-48 bg-primary/5 rounded-full blur-2xl" />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24 md:py-32">
        <div className="grid md:grid-cols-2 gap-12 items-center">
          {/* Content */}
          <div className="text-center md:text-left">
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-6 leading-tight">
              Find Fitness Events{" "}
              <span className="text-primary">Near You</span>
            </h1>
            <p className="text-lg md:text-xl text-muted mb-8 max-w-lg mx-auto md:mx-0">
              Discover local fitness events, classes, and activities. From yoga
              to marathons, find the perfect workout that fits your lifestyle.
            </p>

            {/* Search Form */}
            <form onSubmit={handleSearch} className="max-w-md mx-auto md:mx-0">
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                  <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted" />
                  <input
                    type="text"
                    placeholder="Enter your city or area..."
                    value={searchLocation}
                    onChange={(e) => setSearchLocation(e.target.value)}
                    className="w-full pl-12 pr-4 py-3 bg-dark-light border border-dark-lighter rounded-lg text-white placeholder-muted focus:border-primary focus:ring-1 focus:ring-primary transition-colors"
                  />
                </div>
                <button
                  type="submit"
                  className="flex items-center justify-center gap-2 bg-primary text-dark px-6 py-3 rounded-lg font-semibold hover:bg-primary-light transition-colors duration-200"
                >
                  <Search className="w-5 h-5" />
                  <span>Search</span>
                </button>
              </div>
            </form>

            {/* Quick Links */}
            <div className="mt-8 flex flex-wrap justify-center md:justify-start gap-3">
              <span className="text-muted text-sm">Popular:</span>
              {["New York", "Los Angeles", "Chicago", "Austin"].map((city) => (
                <button
                  key={city}
                  onClick={() => {
                    setSearchLocation(city);
                    router.push(`/events?area=${encodeURIComponent(city)}`);
                  }}
                  className="text-sm text-white hover:text-primary transition-colors"
                >
                  {city}
                </button>
              ))}
            </div>
          </div>

          {/* Hero Image Placeholder */}
          <div className="hidden md:block">
            <div className="relative">
              {/* Main Image Placeholder */}
              <div className="aspect-[4/3] rounded-2xl image-placeholder overflow-hidden shadow-2xl">
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-center">
                    <div className="w-20 h-20 bg-primary/20 rounded-full flex items-center justify-center mx-auto mb-4">
                      <Search className="w-10 h-10 text-primary" />
                    </div>
                    <p className="text-muted text-sm">Hero Image</p>
                    <p className="text-muted-dark text-xs">800 x 600</p>
                  </div>
                </div>
              </div>

              {/* Floating Stats Card */}
              <div className="absolute -bottom-6 -left-6 bg-white rounded-xl p-4 shadow-xl">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center">
                    <span className="text-primary text-xl font-bold">500+</span>
                  </div>
                  <div>
                    <p className="text-dark font-semibold">Events</p>
                    <p className="text-muted text-sm">This month</p>
                  </div>
                </div>
              </div>

              {/* Floating Badge */}
              <div className="absolute -top-4 -right-4 bg-primary text-dark rounded-full px-4 py-2 shadow-lg">
                <span className="font-semibold text-sm">Free Events!</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
