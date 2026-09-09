"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import OrganiserRating from "@/components/OrganiserRating";
import type { OrganiserRating as Rating } from "@/lib/reviews";

type Props = {
  organiserId: string;
  name: string;
  /** Organiser logo, shown as a small avatar before the name. */
  logoUrl?: string | null;
  rating?: Rating | null;
  className?: string;
  /** Override the name text colour classes (default: text-muted hover:text-primary) */
  nameClassName?: string;
  /** Stop card click handlers when the organiser control is used */
  stopPropagation?: boolean;
  /**
   * When the parent is already an <a>/<Link>, render a button-styled control
   * instead of a nested link (invalid HTML).
   */
  nestedInLink?: boolean;
};

/** Organiser name (linked) with optional star rating beside it. */
export default function OrganiserCardMeta({
  organiserId,
  name,
  logoUrl,
  rating,
  className,
  nameClassName,
  stopPropagation = false,
  nestedInLink = false,
}: Props) {
  const router = useRouter();
  const href = `/organisers/${organiserId}`;
  const nameClass = cn(
    // chip-sm opts out of the global 44px mobile touch-target floor when this
    // renders as a button; py/-my expands the tap area for the link case
    // without growing the card's visual footprint.
    "chip-sm font-headline text-[10px] font-medium uppercase tracking-widest transition-colors truncate min-w-0 text-left py-[15px] -my-[15px]",
    nameClassName ?? "text-muted hover:text-primary",
  );

  /* The OrganiserIdentity frame at card scale: same rounded square, same
     dark-lighter ground, same initial fallback, just 24px instead of 40
     (issue #309). */
  const avatar = (
    <span className="relative w-6 h-6 rounded-md overflow-hidden bg-dark-lighter shrink-0">
      {logoUrl ? (
        <Image src={logoUrl} alt="" fill className="object-cover" sizes="24px" />
      ) : (
        <span className="w-full h-full flex items-center justify-center font-headline text-[11px] font-black text-primary">
          {name.charAt(0).toUpperCase()}
        </span>
      )}
    </span>
  );

  return (
    <div className={cn("flex items-center gap-2 min-w-0", className)}>
      {avatar}
      {nestedInLink ? (
        <button
          type="button"
          className={nameClass}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            router.push(href);
          }}
        >
          {name}
        </button>
      ) : (
        <Link
          href={href}
          onClick={stopPropagation ? (e) => e.stopPropagation() : undefined}
          className={nameClass}
        >
          {name}
        </Link>
      )}
      <OrganiserRating rating={rating} />
    </div>
  );
}
