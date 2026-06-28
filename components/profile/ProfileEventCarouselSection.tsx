import Link from "next/link";
import { RefreshCw } from "lucide-react";
import { ScrollCarousel } from "@/components/ui/ScrollCarousel";

interface ProfileEventCarouselSectionProps {
  eyebrow?: string;
  title: string;
  loading?: boolean;
  emptyTitle: string;
  emptyDescription: string;
  browseHref?: string;
  browseLabel?: string;
  children: React.ReactNode;
  itemCount: number;
}

export function ProfileEventCarouselSection({
  eyebrow,
  title,
  loading = false,
  emptyTitle,
  emptyDescription,
  browseHref = "/events",
  browseLabel = "Browse events",
  children,
  itemCount,
}: ProfileEventCarouselSectionProps) {
  if (loading) {
    return (
      <section>
        <div className="mb-4 sm:mb-6">
          {eyebrow && (
            <p className="font-headline text-[10px] sm:text-xs font-medium uppercase tracking-widest text-primary mb-1">
              {eyebrow}
            </p>
          )}
          <h2 className="font-headline text-2xl sm:text-3xl font-black italic tracking-tighter text-light">
            {title}
          </h2>
        </div>
        <div className="flex items-center justify-center py-16">
          <RefreshCw className="w-5 h-5 text-muted animate-spin" />
        </div>
      </section>
    );
  }

  if (itemCount === 0) {
    return (
      <section>
        <div className="mb-4 sm:mb-6">
          {eyebrow && (
            <p className="font-headline text-[10px] sm:text-xs font-medium uppercase tracking-widest text-primary mb-1">
              {eyebrow}
            </p>
          )}
          <h2 className="font-headline text-2xl sm:text-3xl font-black italic tracking-tighter text-light">
            {title}
          </h2>
        </div>
        <div className="rounded-2xl border border-dark-lighter bg-dark/40 px-6 py-12 text-center">
          <p className="font-headline text-base font-black italic tracking-tighter text-light mb-2">
            {emptyTitle}
          </p>
          <p className="text-muted text-sm mb-5 max-w-md mx-auto">{emptyDescription}</p>
          <Link
            href={browseHref}
            className="inline-flex font-headline text-xs font-bold uppercase tracking-widest text-primary hover:underline"
          >
            {browseLabel}
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section>
      <ScrollCarousel eyebrow={eyebrow} title={title} arrowTopClass="top-[98px]">
        {children}
      </ScrollCarousel>
    </section>
  );
}
