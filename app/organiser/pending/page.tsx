import Image from "next/image";
import Link from "next/link";
import { Clock, CheckCircle, XCircle, Mail } from "lucide-react";
import { getOrganiserSession } from "@/lib/auth";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export default async function PendingPage() {
  const session   = await getOrganiserSession();
  const organiser = session
    ? await prisma.organiser.findUnique({ where: { id: session.sub }, select: { status: true, rejectionReason: true, orgName: true } })
    : null;

  const status = organiser?.status ?? "PENDING_REVIEW";

  return (
    <main className="min-h-screen bg-dark-darker flex items-center justify-center px-6">
      <div className="w-full max-w-[520px] text-center">
        <Link href="/organiser">
          <Image src="/images/logo-title.svg" alt="Startline" width={160} height={40} className="h-10 w-auto mx-auto mb-12 opacity-80" />
        </Link>

        {status === "PENDING_REVIEW" && (
          <>
            <div className="w-16 h-16 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center mx-auto mb-6">
              <Clock className="w-7 h-7 text-primary" />
            </div>
            <div className="font-headline text-[11px] font-bold uppercase tracking-[0.25em] text-primary mb-4">Application submitted</div>
            <h1 className="font-headline text-4xl font-black italic tracking-tighter text-light mb-4">
              Under<br /><span className="text-primary">review.</span>
            </h1>
            <p className="text-muted text-[15px] leading-relaxed mb-8">
              Your organiser application is being reviewed by the Startline team. This typically takes 1–2 business days.
              We&apos;ll email you when a decision is made.
            </p>
          </>
        )}

        {status === "REJECTED" && (
          <>
            <div className="w-16 h-16 rounded-full bg-red-900/20 border border-red-500/30 flex items-center justify-center mx-auto mb-6">
              <XCircle className="w-7 h-7 text-red-400" />
            </div>
            <div className="font-headline text-[11px] font-bold uppercase tracking-[0.25em] text-red-400 mb-4">Application not approved</div>
            <h1 className="font-headline text-4xl font-black italic tracking-tighter text-light mb-4">
              Application<br /><span className="text-red-400">declined.</span>
            </h1>
            <p className="text-muted text-[15px] leading-relaxed mb-6">
              Unfortunately your organiser application was not approved at this time.
            </p>
            {organiser?.rejectionReason && (
              <div className="bg-dark border border-dark-lighter rounded-lg p-5 mb-6 text-left">
                <div className="font-headline text-[10px] uppercase tracking-widest text-muted mb-2">Reason</div>
                <p className="text-muted-light text-[14px] leading-relaxed">{organiser.rejectionReason}</p>
              </div>
            )}
            <p className="text-muted text-[14px] leading-relaxed mb-8">
              If you believe this is in error or you&apos;d like to reapply with updated information, contact us.
            </p>
          </>
        )}

        {status === "SUSPENDED" && (
          <>
            <div className="w-16 h-16 rounded-full bg-red-900/20 border border-red-500/30 flex items-center justify-center mx-auto mb-6">
              <XCircle className="w-7 h-7 text-red-400" />
            </div>
            <h1 className="font-headline text-4xl font-black italic tracking-tighter text-light mb-4">
              Account<br /><span className="text-red-400">suspended.</span>
            </h1>
            <p className="text-muted text-[15px] leading-relaxed mb-8">
              Your account has been suspended. Please contact us for more information.
            </p>
          </>
        )}

        <div className="flex items-center justify-center gap-3">
          <a href="mailto:admin@startlineau.com"
            className="flex items-center gap-2 font-headline text-[12px] uppercase tracking-widest text-muted hover:text-primary transition-colors">
            <Mail className="w-4 h-4" /> Contact support
          </a>
          <span className="text-dark-lighter">·</span>
          <Link href="/organiser" className="font-headline text-[12px] uppercase tracking-widest text-muted hover:text-primary transition-colors">
            Sign out
          </Link>
        </div>
      </div>
    </main>
  );
}
