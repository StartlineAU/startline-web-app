const IMAGE_POOLS: Record<string, string[]> = {
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
  swimming: [
    "https://images.unsplash.com/photo-1519311965067-36d3e5f33d39",
    "https://images.unsplash.com/photo-1560088334-4de5f7b9559a",
    "https://images.unsplash.com/photo-1530549387789-4c1017266634",
  ],
  cycling: [
    "https://images.unsplash.com/photo-1485965120184-e220f721d03e",
    "https://images.unsplash.com/photo-1517649763962-0c623066013b",
    "https://images.unsplash.com/photo-1576435728678-68d0fbf94e5c",
  ],
  triathlon: [
    "https://images.unsplash.com/photo-1461896836934-bd45ba8fcf9b",
    "https://images.unsplash.com/photo-1541534741688-6078c8bf2355",
    "https://images.unsplash.com/photo-1571497424536-0f872a53ef4e",
  ],
  duathlon: [
    "https://images.unsplash.com/photo-1571497424536-0f872a53ef4e",
    "https://images.unsplash.com/photo-1461896836934-bd45ba8fcf9b",
    "https://images.unsplash.com/photo-1517649763962-0c623066013b",
  ],
  weightlifting: [
    "https://images.unsplash.com/photo-1534438327276-14e5300c3a48",
    "https://images.unsplash.com/photo-1517836357463-d25dfeac3438",
    "https://images.unsplash.com/photo-1581009146145-b5ef050c2e1e",
  ],
  bodybuilding: [
    "https://images.unsplash.com/photo-1581009146145-b5ef050c2e1e",
    "https://images.unsplash.com/photo-1526506118085-60ce8714f8c5",
    "https://images.unsplash.com/photo-1534438327276-14e5300c3a48",
  ],
};

function buildUrl(base: string, width: number, quality: number): string {
  return `${base}?w=${width}&q=${quality}`;
}

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

export function getCategoryImage(
  type: string,
  width = 600,
  quality = 80
): string {
  const pool = IMAGE_POOLS[type] ?? IMAGE_POOLS.running;
  return buildUrl(pool[0], width, quality);
}

export function getTypeImageArray(
  type: string,
  width = 1920,
  quality = 80
): string[] {
  const pool = IMAGE_POOLS[type] ?? IMAGE_POOLS.running;
  return pool.map((url) => buildUrl(url, width, quality));
}
