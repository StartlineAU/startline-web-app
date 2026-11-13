"use client";

import { animate, splitText, stagger } from "animejs";

/**
 * The listing editor's motion, in one place (anime.js v4, as the FAQ uses it).
 * Every helper is a no-op for visitors who ask for reduced motion, and leaves
 * the element exactly as React rendered it once it finishes.
 *
 * That last part matters: anime leaves its end values inline, and even an
 * identity `translateY(0px)` or `scale(1)` makes the element its own stacking
 * context. A date or time picker opened inside one then paints underneath the
 * field after it (#528), and a fixed overlay inside one is positioned against
 * it instead of the screen. So every animation clears what it set.
 */

/** Drop the inline styles an animation left behind. */
function clear(els: HTMLElement[], props: string[]) {
  for (const el of els) for (const p of props) el.style.removeProperty(p);
}

export function reducedMotion(): boolean {
  if (typeof window === "undefined") return true;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** A panel opening: height from nothing, its children rising in turn. */
export function revealPanel(el: HTMLElement | null) {
  if (!el || reducedMotion()) return;
  const height = el.scrollHeight;
  el.style.overflow = "hidden";
  animate(el, {
    height: [0, height],
    opacity: [0, 1],
    duration: 320,
    ease: "out(3)",
    onComplete: () => clear([el], ["height", "overflow", "opacity"]),
  });
  const children = Array.from(el.children) as HTMLElement[];
  if (children.length) {
    animate(children, {
      translateY: [8, 0], opacity: [0, 1], duration: 360, ease: "out(3)", delay: stagger(45, { start: 60 }),
      onComplete: () => clear(children, ["transform", "opacity"]),
    });
  }
}

/**
 * Scroll just enough that `el`, at its current (full) size, is on screen,
 * moving with it as it opens rather than leaving it hanging off the bottom.
 * The top stays clear of the sticky header, the bottom of the phone save bar.
 */
export function keepInView(el: HTMLElement | null) {
  if (!el) return;
  const rect = el.getBoundingClientRect();
  const top = 140;
  const bottom = window.innerHeight - (window.innerWidth < 1024 ? 96 : 24);
  let delta = 0;
  if (rect.bottom > bottom) delta = rect.bottom - bottom;
  // A row taller than the space shows its top, not its bottom.
  if (rect.top - delta < top) delta = rect.top - top;
  if (Math.abs(delta) < 2) return;
  window.scrollBy({ top: delta, behavior: reducedMotion() ? "instant" : "smooth" });
}

/** A value that has just been filled in, settling into place. */
export function settleIn(el: HTMLElement | null) {
  if (!el || reducedMotion()) return;
  animate(el, {
    translateY: [6, 0], opacity: [0, 1], duration: 380, ease: "out(3)",
    onComplete: () => clear([el], ["transform", "opacity"]),
  });
}

/** Rows of a list arriving one after another. */
export function staggerIn(els: Iterable<Element>) {
  const list = Array.from(els) as HTMLElement[];
  if (!list.length || reducedMotion()) return;
  animate(list, {
    translateX: [-6, 0], opacity: [0, 1], duration: 300, ease: "out(2)", delay: stagger(28),
    onComplete: () => clear(list, ["transform", "opacity"]),
  });
}

/** A small surface (toast, chip, dialog) appearing. */
export function popIn(el: HTMLElement | null, from = 0.94) {
  if (!el || reducedMotion()) return;
  animate(el, {
    scale: [from, 1], opacity: [0, 1], duration: 300, ease: "out(4)",
    onComplete: () => clear([el], ["transform", "opacity"]),
  });
}

/**
 * "You are here": a brief signal-green ring around the field the organiser
 * was just sent to, fading out. Uses a pseudo-ring via box-shadow so layout
 * never moves.
 */
export function spotlight(el: HTMLElement | null) {
  if (!el || reducedMotion()) return;
  const radius = getComputedStyle(el).borderRadius;
  if (!radius || radius === "0px") el.style.borderRadius = "12px";
  animate(el, {
    boxShadow: ["0 0 0 2px rgba(179,225,83,0.55)", "0 0 0 10px rgba(179,225,83,0)"],
    duration: 900,
    ease: "out(2)",
    onComplete: () => clear([el], ["box-shadow"]),
  });
}

/**
 * Write `text` into `el` and reveal it word by word with splitText. React
 * must not own the element's children: render it empty and let this fill it.
 * Returns a cleanup that restores the plain text.
 */
export function revealWords(el: HTMLElement | null, text: string): () => void {
  if (!el) return () => {};
  el.textContent = text;
  if (reducedMotion()) return () => {};
  const split = splitText(el, { words: true });
  const words = (split.words ?? []) as HTMLElement[];
  for (const w of words) { w.style.display = "inline-block"; w.style.opacity = "0"; }
  const animation = animate(words, {
    opacity: [0, 1],
    translateY: [10, 0],
    duration: 480,
    ease: "out(3)",
    delay: stagger(40, { start: 80 }),
  });
  return () => {
    try { animation.pause(); } catch { /* ignore */ }
    try { split.revert(); } catch { /* ignore */ }
    el.textContent = text;
  };
}
