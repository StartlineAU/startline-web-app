"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { ArrowRight, User, Briefcase } from "lucide-react";

export default function SignupPage() {
  const [role, setRole] = useState<"user" | "organiser" | null>(null);

  function handleContinue() {
    if (!role) return;

    document.cookie = `sl_signup_role=${role}; path=/; max-age=3600; samesite=lax`;
    window.location.href = "/auth/login?screen_hint=signup";
  }

  return (
    <main className="min-h-screen bg-dark-darker flex items-center justify-center px-6">
      <div className="w-full max-w-lg">
        {/* Logo */}
        <div className="flex justify-center mb-10">
          <Link href="/">
            <Image
              src="/images/logo-title.svg"
              alt="StartLine"
              width={180}
              height={45}
              className="h-10 w-auto"
            />
          </Link>
        </div>

        <div className="mb-8 text-center">
          <h1 className="font-headline text-3xl sm:text-4xl font-black italic tracking-tighter text-light leading-none mb-2">
            Create your <span className="text-primary">account.</span>
          </h1>
          <p className="text-muted text-sm">
            Choose how you want to use StartLine.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
          <button
            onClick={() => setRole("user")}
            className={`text-left bg-dark border rounded-xl p-6 transition-all ${
              role === "user"
                ? "border-primary ring-2 ring-primary/20"
                : "border-dark-lighter hover:border-primary/40"
            }`}
          >
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center mb-4 ${
              role === "user" ? "bg-primary" : "bg-dark-lighter"
            }`}>
              <User className={`w-5 h-5 ${role === "user" ? "text-dark" : "text-muted"}`} />
            </div>
            <h3 className="font-headline text-lg font-black italic tracking-tighter text-light mb-1">
              I&apos;m an Athlete
            </h3>
            <p className="text-muted text-xs leading-relaxed">
              Discover events, save favourites, and get notified about upcoming competitions.
            </p>
          </button>

          <button
            onClick={() => setRole("organiser")}
            className={`text-left bg-dark border rounded-xl p-6 transition-all ${
              role === "organiser"
                ? "border-primary ring-2 ring-primary/20"
                : "border-dark-lighter hover:border-primary/40"
            }`}
          >
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center mb-4 ${
              role === "organiser" ? "bg-primary" : "bg-dark-lighter"
            }`}>
              <Briefcase className={`w-5 h-5 ${role === "organiser" ? "text-dark" : "text-muted"}`} />
            </div>
            <h3 className="font-headline text-lg font-black italic tracking-tighter text-light mb-1">
              I&apos;m an Organiser
            </h3>
            <p className="text-muted text-xs leading-relaxed">
              Submit and manage your events, and reach athletes across Australia.
            </p>
          </button>
        </div>

        <button
          onClick={handleContinue}
          disabled={!role}
          className="w-full flex items-center justify-center gap-3 bg-machined text-dark font-headline text-sm font-bold uppercase tracking-widest py-4 rounded-xl machined-button-shadow hover:-translate-y-0.5 hover:-translate-x-0.5 transition-transform duration-100 active:translate-x-0 active:translate-y-0 disabled:opacity-30 disabled:cursor-not-allowed disabled:transform-none"
        >
          Continue
          <ArrowRight className="w-4 h-4" />
        </button>

        <p className="mt-6 text-center text-muted text-xs">
          Already have an account?{" "}
          <a href="/auth/login" className="text-primary hover:underline font-medium">
            Sign in
          </a>
        </p>
      </div>
    </main>
  );
}
