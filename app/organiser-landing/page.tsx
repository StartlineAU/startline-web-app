import Link from "next/link";
import { Building2, ArrowRight } from "lucide-react";

export default function OrganiserLandingPage() {
  return (
    <main className="min-h-screen bg-dark-darker flex items-center justify-center px-6">
      <div className="text-center max-w-md">
        <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-6">
          <Building2 className="w-8 h-8 text-primary" />
        </div>
        <h1 className="font-headline text-4xl font-black italic tracking-tighter leading-[0.9] text-light mb-4">
          Organiser<br /><span className="text-primary">Portal</span>
        </h1>
        <p className="text-muted text-[15px] leading-relaxed mb-8">
          Sign in to your customer account, then switch to your organiser profile from the dropdown menu.
        </p>
        <Link
          href="https://startlineau.com"
          className="bg-machined shadow-machined inline-flex items-center gap-2 text-dark font-headline text-sm font-bold uppercase tracking-widest py-4 px-8 rounded-md hover:-translate-x-0.5 hover:-translate-y-0.5 active:translate-x-0 active:translate-y-0 active:shadow-none transition-transform"
        >
          Go to Startline <ArrowRight className="w-4 h-4" />
        </Link>
        <p className="mt-6 font-headline text-[11px] uppercase tracking-widest text-muted">
          Already have an organiser profile?{" "}
          <Link href="/organiser/dashboard" className="text-primary hover:underline">Go to Dashboard</Link>
        </p>
      </div>
    </main>
  );
}
