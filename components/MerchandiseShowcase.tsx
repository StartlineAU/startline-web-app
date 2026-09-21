import Image from "next/image";
import Link from "next/link";
import { ShoppingBag } from "lucide-react";
import type { MerchandiseView, PublicMerchandiseView } from "@/lib/merchandise";

const money = (cents: number) =>
  `$${(cents / 100).toFixed(cents % 100 === 0 ? 0 : 2)}`;

/**
 * An organiser's merchandise as athletes see it on the profile (#338).
 *
 * Read only. Nothing is bought here: items are sold through an event's
 * checkout, so each card names the live events selling it, and says so
 * plainly when none are.
 */
export default function MerchandiseShowcase({
  items,
}: {
  items: (MerchandiseView & Partial<Pick<PublicMerchandiseView, "events">>)[];
}) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4" data-testid="merchandise-showcase">
      {items.map((item) => (
        <div key={item.id} className="rounded-2xl border border-dark-lighter bg-dark overflow-hidden flex flex-col">
          <div className="relative aspect-square bg-dark-light">
            {item.imageUrl ? (
              <Image src={item.imageUrl} alt={item.name} fill sizes="(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw" className="object-cover" />
            ) : (
              <div className="absolute inset-0 grid place-items-center">
                <ShoppingBag className="w-8 h-8 text-muted-dark" />
              </div>
            )}
          </div>

          <div className="p-4 flex flex-col gap-2 flex-1">
            <div className="flex items-start justify-between gap-3">
              <h3 className="font-headline text-base font-black italic tracking-tight text-light leading-tight">
                {item.name}
              </h3>
              <span className="font-headline text-sm font-bold text-primary shrink-0">{money(item.priceCents)}</span>
            </div>

            {item.description && (
              <p className="text-[13px] text-muted leading-relaxed line-clamp-3">{item.description}</p>
            )}

            <div className="flex flex-wrap items-center gap-1.5">
              <span className="font-headline text-[10px] uppercase tracking-widest text-muted-dark mr-0.5">
                {item.optionLabel}
              </span>
              {item.options.map((option) => (
                <span key={option} className="font-headline text-[10px] font-bold uppercase tracking-widest text-light border border-dark-lighter rounded px-1.5 py-0.5">
                  {option}
                </span>
              ))}
            </div>

            {item.events && (
              <div className="mt-auto pt-2 border-t border-dark-lighter">
                {item.events.length > 0 ? (
                  <>
                    <p className="font-headline text-[10px] uppercase tracking-widest text-muted-dark mb-1">
                      Add it to your entry at
                    </p>
                    <ul className="space-y-0.5">
                      {item.events.map((event) => (
                        <li key={event.id}>
                          <Link href={`/events/${event.id}`} className="text-[13px] text-light hover:text-primary transition-colors">
                            {event.title}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </>
                ) : (
                  <p className="font-headline text-[10px] uppercase tracking-widest text-muted-dark">
                    Not on sale at an event right now
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
