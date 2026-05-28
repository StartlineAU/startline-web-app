import { interpolate, spring } from 'remotion';
import { CLAMP } from './colors';

/**
 * Returns CSS transform + opacity values for a scene's entrance and exit.
 *
 * Entrance: slides in from +X with spring physics, fades + scales up slightly.
 * Exit: slides out to -X with ease-in quad, fades + scales up slightly.
 *
 * Both run over OVERLAP frames so adjacent scenes cross-fade cleanly.
 */
export function useSceneTransition(
  frame: number,
  fps: number,
  durationInFrames: number,
  overlap = 18,
) {
  // ── Entrance (spring, 0 → overlap) ──────────────────────────────────────
  const enterSpring = spring({
    fps,
    frame,
    config: { damping: 300, stiffness: 520, mass: 0.42 },
    durationInFrames: overlap,
  });

  const enterX       = interpolate(enterSpring, [0, 1], [72, 0]);
  const enterOpacity = interpolate(enterSpring, [0, 1], [0, 1]);
  const enterScale   = interpolate(enterSpring, [0, 1], [0.97, 1]);

  // ── Exit (linear ease-in, durationInFrames - overlap → durationInFrames) ─
  const exitStart = durationInFrames - overlap;
  const exitP = interpolate(frame, [exitStart, durationInFrames], [0, 1], CLAMP);
  // ease-in quad
  const exitEased = exitP * exitP;

  const exitX       = interpolate(exitEased, [0, 1], [0, -52]);
  const exitOpacity = interpolate(exitEased, [0, 1], [1, 0]);
  const exitScale   = interpolate(exitEased, [0, 1], [1, 1.015]);

  return {
    translateX: enterX + exitX,
    opacity:    Math.min(enterOpacity, exitOpacity),
    scale:      enterScale * exitScale,
  };
}

/** Fade-up helper for individual elements inside a scene. */
export function fadeUp(
  frame: number,
  fps: number,
  delay = 0,
  distance = 28,
) {
  const s = spring({
    fps,
    frame: frame - delay,
    config: { damping: 260, stiffness: 340, mass: 0.55 },
    durationInFrames: 22,
  });
  return {
    opacity:    interpolate(s, [0, 1], [0, 1]),
    translateY: interpolate(s, [0, 1], [distance, 0]),
  };
}

/** Fade-in only (no translation). */
export function fadeIn(frame: number, fps: number, delay = 0) {
  const s = spring({
    fps,
    frame: frame - delay,
    config: { damping: 200, stiffness: 280, mass: 0.6 },
    durationInFrames: 20,
  });
  return { opacity: interpolate(s, [0, 1], [0, 1]) };
}

/** Scale-in from slightly smaller. */
export function scaleIn(frame: number, fps: number, delay = 0) {
  const s = spring({
    fps,
    frame: frame - delay,
    config: { damping: 260, stiffness: 400, mass: 0.5 },
    durationInFrames: 20,
  });
  return {
    scale:   interpolate(s, [0, 1], [0.88, 1]),
    opacity: interpolate(s, [0, 1], [0, 1]),
  };
}

/** Count-up from 0 to target over a frame range. */
export function countUp(
  frame: number,
  target: number,
  startFrame: number,
  endFrame: number,
) {
  const p = interpolate(frame, [startFrame, endFrame], [0, 1], CLAMP);
  // Ease-out cubic
  const eased = 1 - Math.pow(1 - p, 3);
  return Math.round(eased * target);
}
