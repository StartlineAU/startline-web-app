"use client";

import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Info } from "lucide-react";
import { cn } from "@/lib/utils";
import { bubbleIn, bubbleOut } from "./motion";

/** Space between the icon and the bubble. */
const GAP = 8;
/** The page's side gutter: the bubble never runs closer to the screen edge. */
const GUTTER = 16;
/** Height of the site nav plus the editor's sticky header, which a bubble must not open under. */
const HEADER_CLEARANCE = 124;

/** Only one bubble is open at a time: opening one closes the last. */
let openTip: { id: string; close: () => void } | null = null;

/**
 * An info icon that explains what a field wants (#528). The guidance used to
 * sit on the page as small print; now the page shows the icon and the words
 * appear on hover, on keyboard focus, or on tap.
 *
 * - Mouse: hover opens it, leaving closes it. A click pins it open.
 * - Touch: a tap opens it, a second tap or a tap anywhere else closes it.
 * - Keyboard: focus opens it, Escape or moving on closes it.
 *
 * The bubble is portalled to <body> with fixed positioning, so an animating
 * panel's `overflow: hidden` or a parent's stacking context can never clip it.
 * Never place one inside a <button> or <label>: it is a button itself.
 */
export function InfoTip({ label, children, className }: {
  /** What the bubble is about, e.g. "Tickets available". Heads the bubble and names the icon. */
  label: string;
  children: ReactNode;
  className?: string;
}) {
  const id = useId();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const bubbleRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [below, setBelow] = useState(false);
  const belowRef = useRef(false);
  const pinned = useRef(false);
  const closing = useRef(false);
  const hideTimer = useRef(0);
  const anim = useRef<{ cancel: () => unknown } | null>(null);

  /** Put the bubble above the icon, or below when the header is in the way; keep it on screen. */
  const place = useCallback(() => {
    const button = buttonRef.current;
    const bubble = bubbleRef.current;
    if (!button || !bubble) return;
    const b = button.getBoundingClientRect();
    const w = bubble.offsetWidth;
    const h = bubble.offsetHeight;
    const centre = b.left + b.width / 2;
    const left = Math.min(Math.max(centre - w / 2, GUTTER), window.innerWidth - w - GUTTER);
    const isBelow = b.top - HEADER_CLEARANCE < h + GAP;
    bubble.style.left = `${left}px`;
    bubble.style.top = `${isBelow ? b.bottom + GAP : b.top - GAP - h}px`;
    bubble.style.setProperty("--arrow-x", `${centre - left}px`);
    belowRef.current = isBelow;
    setBelow(isBelow);
  }, []);

  const hide = useCallback(() => {
    window.clearTimeout(hideTimer.current);
    pinned.current = false;
    if (closing.current) return;
    if (openTip?.id === id) openTip = null;
    closing.current = true;
    anim.current?.cancel();
    anim.current = bubbleOut(bubbleRef.current, belowRef.current, () => {
      closing.current = false;
      setOpen(false);
    });
  }, [id]);

  const show = useCallback(() => {
    window.clearTimeout(hideTimer.current);
    if (openTip && openTip.id !== id) openTip.close();
    openTip = { id, close: hide };
    if (closing.current) {
      // Caught on its way out: bring it straight back.
      closing.current = false;
      anim.current?.cancel();
      anim.current = bubbleIn(bubbleRef.current, belowRef.current);
    }
    setOpen(true);
  }, [id, hide]);

  /** A short grace period, so the pointer can cross from the icon onto the bubble. */
  const hideSoon = () => {
    if (pinned.current) return;
    window.clearTimeout(hideTimer.current);
    hideTimer.current = window.setTimeout(hide, 120);
  };

  // Placed before paint, so it never flashes in the corner first.
  useLayoutEffect(() => {
    if (!open) return;
    place();
    anim.current = bubbleIn(bubbleRef.current, belowRef.current);
  }, [open, place]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      hide();
      buttonRef.current?.focus();
    };
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (!buttonRef.current?.contains(t) && !bubbleRef.current?.contains(t)) hide();
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onDown);
    window.addEventListener("scroll", place, true);
    window.addEventListener("resize", place);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onDown);
      window.removeEventListener("scroll", place, true);
      window.removeEventListener("resize", place);
    };
  }, [open, hide, place]);

  useEffect(() => () => {
    window.clearTimeout(hideTimer.current);
    if (openTip?.id === id) openTip = null;
  }, [id]);

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        aria-label={`About ${label.toLowerCase()}`}
        aria-expanded={open}
        aria-describedby={open ? id : undefined}
        data-testid="info-tip"
        onClick={e => {
          e.preventDefault();
          e.stopPropagation();
          if (open && pinned.current) { hide(); return; }
          pinned.current = true;
          show();
        }}
        onPointerEnter={e => { if (e.pointerType === "mouse") show(); }}
        onPointerLeave={e => { if (e.pointerType === "mouse") hideSoon(); }}
        onFocus={e => { if (e.currentTarget.matches(":focus-visible")) show(); }}
        onBlur={() => { if (!pinned.current) hide(); }}
        className={cn(
          "relative inline-flex items-center justify-center w-5 h-5 -my-1 align-middle rounded-full shrink-0",
          "text-muted hover:text-primary focus-visible:text-primary transition-[color,transform] duration-200 hover:scale-110",
          "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/60",
          // A finger-sized target without moving the layout.
          "after:absolute after:-inset-2.5 after:content-['']",
          open && "text-primary",
          className,
        )}
      >
        <Info className="w-3.5 h-3.5" strokeWidth={2.25} aria-hidden="true" />
      </button>
      {open && typeof document !== "undefined" && createPortal(
        <div
          ref={bubbleRef}
          id={id}
          role="tooltip"
          onPointerEnter={e => { if (e.pointerType === "mouse") show(); }}
          onPointerLeave={e => { if (e.pointerType === "mouse") hideSoon(); }}
          style={{ left: -9999, top: 0 }}
          className="fixed z-[70] w-max max-w-[min(272px,calc(100vw-32px))] rounded-lg border border-dark-lighter bg-dark-light px-3.5 py-3 shadow-2xl normal-case tracking-normal text-left"
        >
          <span
            aria-hidden="true"
            style={{ left: "var(--arrow-x)" }}
            className={cn(
              "absolute w-2.5 h-2.5 -translate-x-1/2 rotate-45 bg-dark-light border-dark-lighter",
              below ? "-top-[6px] border-l border-t" : "-bottom-[6px] border-r border-b",
            )}
          />
          <span className="block font-headline text-[10px] font-bold uppercase tracking-widest text-primary mb-1">{label}</span>
          <span className="block text-[13px] font-normal leading-snug text-light/90">{children}</span>
        </div>,
        document.body,
      )}
    </>
  );
}
