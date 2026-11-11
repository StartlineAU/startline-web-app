// Renders the email icons and logo to PNG. Gmail and Outlook do not display
// SVG images, so emails reference these files instead.
//
//   node scripts/email-icons.mjs
//
// Output goes to public/email. Re-run after changing a shape or colour here.
import { mkdir, copyFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";

// sharp ships with Next for image optimisation; borrow it rather than adding a
// direct dependency for a script that runs once per icon change.
const fromNext = createRequire(createRequire(import.meta.url).resolve("next/package.json"));
const sharp = fromNext("sharp");

const out = path.join(process.cwd(), "public", "email", "icons");
await mkdir(out, { recursive: true });

const GREEN = "#B3E153";
const INK = "#141414";
const AMBER = "#FBBF24";
const RED = "#F87171";
const BLUE = "#60A5FA";

// Lucide shapes (24 viewBox, 2px stroke, round caps), per design.md §8.
const stroke = (color, body) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;

const icons = {
  // Filled status disc with a dark-ink check: text on green is always #141414.
  check: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><circle cx="12" cy="12" r="12" fill="${GREEN}"/><path d="M7 12.3l3.4 3.3L17 9" stroke="${INK}" stroke-width="2.4" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  alert: stroke(AMBER, '<circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>'),
  "alert-danger": stroke(RED, '<circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>'),
  clock: stroke(BLUE, '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>'),
  shield: stroke(GREEN, '<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/>'),
};

for (const [name, svg] of Object.entries(icons)) {
  // 36px: the 18px display size at 2x, for high-density screens.
  await sharp(Buffer.from(svg), { density: 288 }).resize(36, 36).png().toFile(path.join(out, `${name}.png`));
  console.log(`public/email/icons/${name}.png`);
}

// The flag mark + white wordmark, 600x90, shown at 160x24.
await copyFile(
  path.join(process.cwd(), "public", "images", "logo-email.png"),
  path.join(process.cwd(), "public", "email", "logo.png"),
);
console.log("public/email/logo.png");
