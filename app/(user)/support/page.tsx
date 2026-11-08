import type { Metadata } from "next";
import SupportForm from "@/components/support/SupportForm";

export const metadata: Metadata = {
  title: "Support",
  description: "Ask Startline for help with an entry, including a refund.",
};

export default function SupportPage() {
  return (
    <main className="min-h-screen bg-dark-darker pt-24 pb-16">
      <div className="max-w-[640px] mx-auto px-6">
        <p className="font-headline text-[11px] font-bold uppercase tracking-[0.25em] text-primary">Support</p>
        <h1 className="font-headline text-[36px] font-black italic tracking-tighter text-light mt-2">Open a ticket</h1>
        <p className="text-[14px] text-muted mt-3 mb-8 leading-relaxed">
          Tell us the event and what you need. A refund request is reviewed by Startline. It is not issued when you submit this form.
        </p>
        <SupportForm />
      </div>
    </main>
  );
}
