"use client";

import { useRef } from "react";

export const CENTRED = "50% 50%";

/** Splits a CSS object-position ("37.5% 62.0%") into numbers, centring anything unreadable. */
export function parsePosition(position: string | null | undefined): [number, number] {
  const [x, y] = (position ?? "").split(" ").map(v => parseFloat(v));
  return [Number.isFinite(x) ? x : 50, Number.isFinite(y) ? y : 50];
}

/**
 * Drag a cropped picture to choose which part of it shows. Spread the returned
 * handlers on the element the picture fills; its size turns pointer travel into
 * object-position percentages. Dragging right moves the picture right, which
 * shows more of its left side, so the percentage moves the other way. Pointer
 * events cover mouse, touch and pen alike.
 *
 * Shared by the organisation's cover and logo (settings) and the event cover
 * in the event editor (issue #586).
 */
export function useDragPosition({ enabled, position, onChange }: {
  enabled: boolean;
  position: string;
  onChange: (position: string) => void;
}) {
  const frameRef = useRef<HTMLDivElement>(null);
  const dragStart = useRef<{ x: number; y: number; px: number; py: number } | null>(null);

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!enabled) return;
    e.preventDefault();
    const [px, py] = parsePosition(position);
    dragStart.current = { x: e.clientX, y: e.clientY, px, py };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const start = dragStart.current;
    if (!start || !frameRef.current) return;
    const rect = frameRef.current.getBoundingClientRect();
    const clamp = (n: number) => Math.min(100, Math.max(0, n));
    const x = clamp(start.px + ((e.clientX - start.x) / rect.width)  * -100);
    const y = clamp(start.py + ((e.clientY - start.y) / rect.height) * -100);
    onChange(`${x.toFixed(1)}% ${y.toFixed(1)}%`);
  };
  const endDrag = () => { dragStart.current = null; };

  // Arrow keys nudge the picture the way a drag in that direction would, for
  // anyone not using a pointer. Only reaches an element that can take focus.
  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (!enabled) return;
    const step = e.shiftKey ? 10 : 2;
    const move: Record<string, [number, number]> = {
      ArrowLeft: [step, 0], ArrowRight: [-step, 0], ArrowUp: [0, step], ArrowDown: [0, -step],
    };
    const delta = move[e.key];
    if (!delta) return;
    e.preventDefault();
    const [px, py] = parsePosition(position);
    const clamp = (n: number) => Math.min(100, Math.max(0, n));
    onChange(`${clamp(px + delta[0]).toFixed(1)}% ${clamp(py + delta[1]).toFixed(1)}%`);
  };

  return {
    frameRef,
    handlers: { onPointerDown, onPointerMove, onPointerUp: endDrag, onPointerCancel: endDrag, onKeyDown },
  };
}
