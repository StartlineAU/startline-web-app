const MAX_SLUG_LENGTH = 80;

/**
 * Human-readable URL slug derived from a title. Mirrors the backfill in
 * `prisma/migrations/*_add_event_slug` — keep them in sync.
 *
 * This module deliberately has no database imports. The seed loads `.env.local`
 * after ESM has evaluated its static imports, so importing anything that
 * constructs the app Prisma client from here would initialise it before the
 * database URL is loaded.
 */
export function slugify(title: string): string {
  return (
    title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, MAX_SLUG_LENGTH)
      .replace(/-+$/g, "") || "event"
  );
}
