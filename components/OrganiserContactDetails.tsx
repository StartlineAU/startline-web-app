import { Mail, Phone, UserRound } from "lucide-react";
import { telHref, type OrganiserContact } from "@/lib/organiser-contact";
import { cn } from "@/lib/utils";

/**
 * The organiser contact details an organisation chose to show (see
 * lib/organiser-contact.ts). Shared by the event page and the athlete's ticket
 * so both list the same details the same way.
 *
 * `inert` is the listing editor's preview: the rows are not links there.
 */
export default function OrganiserContactDetails({
  contact,
  compact = false,
  inert = false,
  className,
}: {
  contact: OrganiserContact;
  compact?: boolean;
  inert?: boolean;
  className?: string;
}) {
  const rows = [
    contact.name && { key: "name", icon: UserRound, label: "Contact", value: contact.name, href: null },
    contact.email && { key: "email", icon: Mail, label: "Email", value: contact.email, href: `mailto:${contact.email}` },
    contact.phone && { key: "phone", icon: Phone, label: "Phone", value: contact.phone, href: telHref(contact.phone) },
  ].filter((row): row is Exclude<typeof row, null | "" | false> => !!row);

  return (
    <ul
      data-testid="organiser-contact"
      className={cn(compact ? "space-y-1.5" : "grid gap-2 sm:grid-cols-3", className)}
    >
      {rows.map(({ key, icon: Icon, label, value, href }) => {
        const body = (
          <>
            <Icon className={cn("shrink-0 text-primary", compact ? "w-3.5 h-3.5" : "w-4 h-4")} aria-hidden="true" />
            <span className="min-w-0">
              {!compact && (
                <span className="block font-headline text-[10px] font-medium uppercase tracking-widest text-muted">
                  {label}
                </span>
              )}
              <span className={cn("block truncate text-light", compact ? "text-[13px]" : "font-headline text-sm font-bold")}>
                {compact && <span className="sr-only">{label}: </span>}
                {value}
              </span>
            </span>
          </>
        );
        const rowClass = cn(
          "flex items-center gap-3 min-w-0",
          !compact && "bg-dark rounded-xl px-4 py-3 border border-transparent",
        );
        return (
          <li key={key} data-contact={key} className="min-w-0">
            {href && !inert ? (
              <a href={href} className={cn(rowClass, "transition-colors hover:text-primary", !compact && "hover:border-primary/40")}>
                {body}
              </a>
            ) : (
              <div className={rowClass}>{body}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
