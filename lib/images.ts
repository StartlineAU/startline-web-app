/**
 * Centralised Unsplash image pools for each event discipline.
 *
 * URLs are stored without size params so every consumer can request the
 * resolution it actually needs (thumbnails vs. full-bleed hero).
 */
const IMAGE_POOLS: Record<string, string[]> = {
  functional_fitness: [
    "https://images.unsplash.com/photo-1571008887538-b36bb32f4571",
    "https://images.unsplash.com/photo-1549060279-7e168fcee0c2",
    "https://images.unsplash.com/photo-1517963879433-6ad2b056d712",
  ],
  crossfit: [
    "https://images.unsplash.com/photo-1534438327276-14e5300c3a48",
    "https://images.unsplash.com/photo-1517836357463-d25dfeac3438",
    "https://images.unsplash.com/photo-1526506118085-60ce8714f8c5",
  ],
  running: [
    "https://images.unsplash.com/photo-1476480862126-209bfaa8edc8",
    "https://images.unsplash.com/photo-1502904550040-7534597429ae",
    "https://images.unsplash.com/photo-1544717305-2782549b5136",
  ],
  hybrid: [
    "https://images.unsplash.com/photo-1552674605-db6ffd4facb5",
    "https://images.unsplash.com/photo-1583454110551-21f2fa2afe61",
    "https://images.unsplash.com/photo-1574680096145-d05b474e2155",
  ],
};

function buildUrl(base: string, width: number, quality: number): string {
  return `${base}?w=${width}&q=${quality}`;
}

/**
 * Deterministic image for an event card. Cycles through the pool using the
 * last character of the event ID so the same event always gets the same image.
 */
export function getEventImage(
  type: string,
  id: string,
  width = 800,
  quality = 70
): string {
  const pool = IMAGE_POOLS[type] ?? IMAGE_POOLS.running;
  const idx = id.charCodeAt(id.length - 1) % pool.length;
  return buildUrl(pool[idx], width, quality);
}

/**
 * Alternate image for the same event (e.g. related-events rail).
 * Uses a different hash so it picks a different photo from the pool.
 */
export function getAlternateEventImage(
  type: string,
  id: string,
  width = 800,
  quality = 70
): string {
  const pool = IMAGE_POOLS[type] ?? IMAGE_POOLS.running;
  const idx = (id.charCodeAt(0) + id.charCodeAt(id.length - 1)) % pool.length;
  return buildUrl(pool[idx], width, quality);
}

/** Representative image for a discipline category tile. */
export function getCategoryImage(
  type: string,
  width = 600,
  quality = 80
): string {
  const pool = IMAGE_POOLS[type] ?? IMAGE_POOLS.running;
  return buildUrl(pool[0], width, quality);
}

/** All images for a discipline — used for hero carousels on the detail page. */
export function getTypeImageArray(
  type: string,
  width = 1920,
  quality = 80
): string[] {
  const pool = IMAGE_POOLS[type] ?? IMAGE_POOLS.running;
  return pool.map((url) => buildUrl(url, width, quality));
}
