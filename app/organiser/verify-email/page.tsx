import Image from "next/image";
import Link from "next/link";
import { Mail } from "lucide-react";

export default function VerifyEmailPage() {
  return (
    <main className="min-h-screen bg-dark-darker flex items-center justify-center px-6">
      <div className="w-full max-w-[480px] text-center">
        <Link href="/organiser">
          <Image src="/images/logo-title.svg" alt="Startline" width={160} height={40} className="h-10 w-auto mx-auto mb-12 opacity-80" />
        </Link>

        <div className="w-16 h-16 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center mx-auto mb-6">
          <Mail className="w-7 h-7 text-primary" />
        </div>

        <div className="font-headline text-[11px] font-bold uppercase tracking-[0.25em] text-primary mb-4">
          Check your inbox
        </div>
        <h1 className="font-headline text-4xl font-black italic tracking-tighter text-light mb-4">
          Verify your<br /><span className="text-primary">email address.</span>
        </h1>
        <p className="text-muted text-[15px] leading-relaxed mb-8">
          We&apos;ve sent a verification link to your email. Click it to verify your address and continue
          setting up your organiser account.
        </p>

        <div className="bg-dark border border-dark-lighter rounded-lg p-5 text-left mb-8">
          <div className="font-headline text-[10px] uppercase tracking-widest text-muted mb-3">What happens next</div>
          <ul className="space-y-2">
            {["Click the link in your email","Complete your organiser profile","Submit your application for review","Get approved and start listing events"].map((s, i) => (
              <li key={i} className="flex items-center gap-3 font-headline text-[12px] uppercase tracking-widest text-muted-light">
                <span className="w-5 h-5 rounded-full bg-dark-light border border-dark-lighter flex items-center justify-center font-headline text-[10px] text-muted flex-shrink-0">{i + 1}</span>
                {s}
              </li>
            ))}
          </ul>
        </div>

        <p className="font-headline text-[12px] uppercase tracking-widest text-muted">
          Didn&apos;t receive it? Check your spam folder, or{" "}
          <Link href="/organiser/register" className="text-primary hover:underline">try a different email</Link>.
        </p>
      </div>
    </main>
  );
}
