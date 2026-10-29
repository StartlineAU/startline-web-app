"use client";

import { UserRound, UserPlus } from "lucide-react";
import { cn } from "@/lib/utils";

export type TicketHolder = "self" | "guest";

interface TicketHolderToggleProps {
  value: TicketHolder;
  onChange: (value: TicketHolder) => void;
  /** Another ticket in the order is already the buyer's own, so this one can't be. */
  selfTakenBy?: number | null;
}

/** Signed-in buyers say whether a ticket is theirs (filled from their profile)
    or someone else's (blank, for a guest's details). */
export default function TicketHolderToggle({ value, onChange, selfTakenBy }: TicketHolderToggleProps) {
  const selfDisabled = selfTakenBy != null;
  const options: { key: TicketHolder; label: string; Icon: typeof UserRound; disabled?: boolean }[] = [
    { key: "self", label: "Me", Icon: UserRound, disabled: selfDisabled },
    { key: "guest", label: "Someone else", Icon: UserPlus },
  ];

  return (
    <div className="mb-5">
      <div className="font-headline text-[9.5px] font-bold uppercase tracking-[0.2em] text-muted-dark mb-2.5">
        Who is this ticket for?
      </div>
      <div role="radiogroup" aria-label="Who is this ticket for?" className="flex flex-wrap gap-2">
        {options.map(({ key, label, Icon, disabled }) => {
          const active = value === key;
          return (
            <button
              key={key}
              type="button"
              role="radio"
              aria-checked={active}
              disabled={disabled}
              onClick={() => onChange(key)}
              className={cn(
                "inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full border font-headline text-[11px] font-bold uppercase tracking-widest transition-colors disabled:opacity-40 disabled:pointer-events-none",
                active
                  ? "bg-primary/10 border-primary/30 text-primary"
                  : "border-dark-lighter text-muted hover:border-primary/30 hover:text-light"
              )}
            >
              <Icon className="w-3.5 h-3.5" /> {label}
            </button>
          );
        })}
      </div>
      {selfDisabled && (
        <p className="text-[12px] text-muted-dark mt-2">Ticket {selfTakenBy + 1} is yours. Switch it to someone else to use this one.</p>
      )}
    </div>
  );
}
