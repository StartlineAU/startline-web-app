/**
 * One-off: run every stored event description, and every pending edit's
 * description, through the same allow-list the routes now apply on write
 * (lib/sanitize-html.ts).
 *
 * Descriptions saved before the routes sanitised on write can hold arbitrary
 * HTML. Every place that renders one sanitises it too, so this is about the
 * stored data itself: exports, emails or any future renderer must not
 * inherit it.
 *
 *   npx tsx scripts/sanitize-event-descriptions.ts          # report only, writes nothing
 *   npx tsx scripts/sanitize-event-descriptions.ts --apply  # write the changes
 *
 * Point DATABASE_URL at the environment first. It prints ids only, never the
 * descriptions themselves.
 */
import "dotenv/config";
import prisma from "../lib/prisma";
import { sanitizeHtml } from "../lib/sanitize-html";

const apply = process.argv.includes("--apply");

async function main() {
  let eventsChanged = 0;
  let cursor: string | undefined;
  for (;;) {
    const batch = await prisma.event.findMany({
      where: { description: { not: null } },
      select: { id: true, description: true },
      orderBy: { id: "asc" },
      take: 200,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
    });
    if (batch.length === 0) break;
    cursor = batch[batch.length - 1].id;

    for (const event of batch) {
      const clean = sanitizeHtml(event.description!);
      if (clean === event.description) continue;
      eventsChanged++;
      console.log(`  event ${event.id}: description changes`);
      if (apply) {
        await prisma.event.update({ where: { id: event.id }, data: { description: clean } });
      }
    }
  }

  let revisionsChanged = 0;
  const pending = await prisma.eventRevision.findMany({
    where: { status: "PENDING" },
    select: { id: true, payload: true },
  });
  for (const revision of pending) {
    const payload = revision.payload;
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) continue;
    const description = (payload as Record<string, unknown>).description;
    if (typeof description !== "string") continue;
    const clean = sanitizeHtml(description);
    if (clean === description) continue;
    revisionsChanged++;
    console.log(`  pending edit ${revision.id}: description changes`);
    if (apply) {
      await prisma.eventRevision.update({
        where: { id: revision.id },
        data: { payload: { ...(payload as Record<string, unknown>), description: clean } },
      });
    }
  }

  console.log(
    `\n${apply ? "Sanitised" : "Would sanitise"} ${eventsChanged} event description(s) and ` +
      `${revisionsChanged} pending edit(s).${apply ? "" : " Re-run with --apply to write."}`,
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
