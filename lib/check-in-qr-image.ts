const WIDTH = 1200;
const HEIGHT = 1200;
const INK = "#141414";
const MUTED = "#6E737B";
const HAIRLINE = "#E5E7EB";
const SIGNAL = "#B3E153";

function slugify(value: string): string {
  return (
    value
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "event"
  );
}

export function checkInQrImageFilename(eventTitle: string): string {
  return `${slugify(eventTitle)}-check-in-qr.png`;
}

/** Centred uppercase text with the wide tracking the brand uses for chrome. */
function fillSpacedText(
  ctx: CanvasRenderingContext2D,
  text: string,
  centerX: number,
  y: number,
  spacing: number,
): void {
  const characters = [...text];
  const widths = characters.map((character) => ctx.measureText(character).width);
  const total =
    widths.reduce((sum, width) => sum + width, 0) + spacing * (characters.length - 1);

  const previousAlign = ctx.textAlign;
  ctx.textAlign = "left";
  let x = centerX - total / 2;
  characters.forEach((character, index) => {
    ctx.fillText(character, x, y);
    x += widths[index] + spacing;
  });
  ctx.textAlign = previousAlign;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Image could not be loaded."));
    image.src = src;
  });
}

/** Break a title into at most `maxLines` lines that fit `maxWidth`. */
function wrapTitle(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxLines: number,
): string[] {
  const words = text.trim().split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";

  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (lines.length === maxLines - 1) {
      // Last line: keep appending and clip once it overflows.
      line = candidate;
      continue;
    }
    if (ctx.measureText(candidate).width <= maxWidth || !line) {
      line = candidate;
      continue;
    }
    lines.push(line);
    line = word;
  }
  if (line) lines.push(line);

  return lines.map((entry) => {
    if (ctx.measureText(entry).width <= maxWidth) return entry;
    let clipped = entry;
    while (clipped.length > 1 && ctx.measureText(`${clipped}…`).width > maxWidth) {
      clipped = clipped.slice(0, -1);
    }
    return `${clipped}…`;
  });
}

/**
 * Compose the check-in QR into a square, social/print-friendly PNG.
 *
 * Drawn in the browser so the displayed QR and the download are guaranteed to
 * encode the same link, and so no server-side image compositor is needed.
 */
export async function buildCheckInQrImage(opts: {
  qrDataUrl: string;
  eventTitle: string;
  organiserName?: string | null;
}): Promise<Blob> {
  if (typeof document === "undefined") {
    throw new Error("The QR image can only be built in the browser.");
  }

  const [qr, wordmark, flag] = await Promise.all([
    loadImage(opts.qrDataUrl),
    loadImage("/images/startline-title-black.png").catch(() => null),
    loadImage("/images/logo.svg").catch(() => null),
  ]);

  await document.fonts.ready;

  const canvas = document.createElement("canvas");
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas is not available.");

  // White paper, with signal-green edge bands.
  ctx.fillStyle = "#FFFFFF";
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  ctx.fillStyle = SIGNAL;
  ctx.fillRect(0, 0, WIDTH, 22);
  ctx.fillRect(0, HEIGHT - 22, WIDTH, 22);

  ctx.textAlign = "center";
  ctx.textBaseline = "top";

  if (opts.organiserName) {
    ctx.fillStyle = MUTED;
    ctx.font = "700 23px Inter, Helvetica, Arial, sans-serif";
    fillSpacedText(ctx, opts.organiserName.toUpperCase(), WIDTH / 2, 70, 4);
  }

  ctx.fillStyle = INK;
  ctx.font = "700 56px Inter, Helvetica, Arial, sans-serif";
  const lines = wrapTitle(ctx, opts.eventTitle, 1020, 2);
  lines.forEach((line, index) => {
    ctx.fillText(line, WIDTH / 2, 118 + index * 66);
  });

  ctx.fillStyle = INK;
  ctx.font = "700 30px Inter, Helvetica, Arial, sans-serif";
  fillSpacedText(ctx, "SCAN TO CHECK IN", WIDTH / 2, 276, 5);

  ctx.strokeStyle = INK;
  ctx.lineWidth = 4;
  ctx.strokeRect(258, 330, 684, 684);
  ctx.drawImage(qr, 270, 342, 660, 660);

  ctx.strokeStyle = HAIRLINE;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(80, 1052);
  ctx.lineTo(WIDTH - 80, 1052);
  ctx.stroke();

  if (flag) {
    ctx.drawImage(flag, 80, 1077, 176, 52);
  }
  if (wordmark) {
    ctx.drawImage(wordmark, flag ? 276 : 80, 1076, 400, 56);
  } else {
    ctx.fillStyle = INK;
    ctx.font = "700 40px Inter, Helvetica, Arial, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText("STARTLINE", flag ? 276 : 80, 1082);
  }

  ctx.fillStyle = MUTED;
  ctx.font = "500 22px Inter, Helvetica, Arial, sans-serif";
  ctx.textAlign = "right";
  ctx.fillText("startlineau.com", WIDTH - 80, 1094);

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Could not create the PNG."))),
      "image/png",
    );
  });
}
