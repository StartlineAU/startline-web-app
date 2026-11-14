"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { reportClientError } from "@/lib/report-client-error";

// Catches render errors below the root layout, so the header and fonts stay
// and the visitor gets a way back instead of a blank page.
export default function RouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    reportClientError(error, "boundary");
  }, [error]);

  return (
    <main className="mx-auto flex min-h-[60vh] max-w-xl flex-col items-center justify-center gap-6 px-4 py-16 text-center">
      <h1 className="font-headline text-2xl font-bold uppercase tracking-widest text-light">
        Something went wrong
      </h1>
      <p className="text-muted">
        This page hit an error. It has been reported. Try again, or head back to the home page.
      </p>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <Button onClick={reset}>Try again</Button>
        <Button variant="outline" asChild>
          <Link href="/">Home</Link>
        </Button>
      </div>
    </main>
  );
}
