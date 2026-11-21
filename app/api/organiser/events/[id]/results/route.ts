import { NextRequest, NextResponse } from "next/server";
import { requireOrganiser } from "@/lib/organiser-api-auth";
import prisma from "@/lib/prisma";
import { isValidRaceTime, normalisePlacement, normaliseRaceTime } from "@/lib/race-results";
import type { Prisma } from "@prisma/client";
import { idParams } from "@/lib/schemas";
import { z } from "zod";
import { EVENT_FIELD_LABELS, recordEventChange } from "@/lib/event-change-log";
import { effectiveEventStatus } from "@/lib/event-lifecycle";

const resultRowSchema = z.object({
  registrationId: z.string().max(255).optional(),
  athleteEmail: z.string().max(255).optional(),
  resultDistance: z.string().max(100).nullable().optional(),
  resultTime: z.string().max(50).nullable().optional(),
  resultPlacement: z.string().max(100).nullable().optional(),
  isPersonalBest: z.boolean().optional(),
  isTopResult: z.boolean().optional(),
  /**
   * The athlete's division (Registration.category). A name the event doesn't
   * list yet is added to the event's divisions, for organisers who forgot to
   * set them up before entries opened.
   */
  division: z.string().trim().max(60).nullable().optional(),
});

const resultsPatchSchema = z.object({
  results: z.array(resultRowSchema).min(1),
});

/** PATCH — bulk-set race results. Match by registrationId, else athleteEmail (case-insensitive). */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireOrganiser();
  if (auth.error) return auth.error;
  const session = auth.session;

  const parsedParams = idParams.safeParse(await params);
  if (!parsedParams.success) return NextResponse.json({ error: "Invalid id." }, { status: 400 });
  const { id } = parsedParams.data;

  const event = await prisma.event.findUnique({
    where: { id },
    select: {
      id: true, organiserId: true, title: true, categories: true,
      status: true, startsAtUtc: true, endsAtUtc: true,
    },
  });
  if (!event) return NextResponse.json({ error: "Not found." }, { status: 404 });
  if (event.organiserId !== session.sub) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const parsedBody = resultsPatchSchema.safeParse(await req.json().catch(() => null));
  if (!parsedBody.success) {
    return NextResponse.json({ error: "results array is required." }, { status: 400 });
  }
  const results = parsedBody.data.results;

  const registrations = await prisma.registration.findMany({
    where: { eventId: id },
    select: { id: true, athleteEmail: true },
  });
  const byId = new Map(registrations.map((r) => [r.id, r]));
  const byEmail = new Map(
    registrations.map((r) => [r.athleteEmail.toLowerCase(), r])
  );

  // Divisions match the event's list case-insensitively and take its spelling;
  // anything new is appended once, in the order it first appears.
  const existingDivisions = Array.isArray(event.categories)
    ? (event.categories as unknown[]).filter((c): c is string => typeof c === "string")
    : [];
  const divisionByKey = new Map(existingDivisions.map((d) => [d.toLowerCase(), d]));
  const addedDivisions: string[] = [];
  const resolveDivision = (raw: string | null | undefined): string | null => {
    const name = raw?.trim();
    if (!name) return null;
    const known = divisionByKey.get(name.toLowerCase());
    if (known) return known;
    divisionByKey.set(name.toLowerCase(), name);
    addedDivisions.push(name);
    return name;
  };

  const updates: { id: string; data: Prisma.RegistrationUpdateInput }[] = [];
  const unmatched: typeof results = [];
  // Rows that found an athlete but carry a finish time nobody could read. They
  // are skipped rather than failing the whole batch, so one typo in a 500-row
  // CSV doesn't cost the organiser every other result.
  const invalidTimes: { athlete: string; value: string }[] = [];

  for (const row of results) {
    const match =
      (row.registrationId && byId.get(row.registrationId)) ||
      (row.athleteEmail && byEmail.get(row.athleteEmail.toLowerCase())) ||
      null;

    if (!match) {
      unmatched.push(row);
      continue;
    }

    const rawTime = row.resultTime?.trim();
    if (rawTime && !isValidRaceTime(rawTime)) {
      invalidTimes.push({ athlete: match.athleteEmail, value: rawTime });
      continue;
    }

    const data: Prisma.RegistrationUpdateInput = {};
    if ("resultDistance" in row)  data.resultDistance  = row.resultDistance?.trim() || null;
    if ("resultTime" in row)      data.resultTime      = rawTime ? normaliseRaceTime(rawTime) : null;
    // A bare number ("43") is stored as the ordinal athletes read ("43rd").
    if ("resultPlacement" in row) data.resultPlacement = normalisePlacement(row.resultPlacement);
    if ("isPersonalBest" in row)  data.isPersonalBest  = !!row.isPersonalBest;
    if ("isTopResult" in row)     data.isTopResult     = !!row.isTopResult;
    if ("division" in row)        data.category        = resolveDivision(row.division);

    if (Object.keys(data).length === 0) continue;
    updates.push({ id: match.id, data });
  }

  if (updates.length > 0) {
    await prisma.$transaction(async (tx) => {
      if (addedDivisions.length > 0) {
        const next = [...existingDivisions, ...addedDivisions];
        await tx.event.update({ where: { id }, data: { categories: next } });
        // Logged like any other edit, so the event's history shows when a
        // division appeared and who added it.
        await recordEventChange(tx, {
          eventId: id,
          eventTitle: event.title,
          source: "ORGANISER",
          kind: "EDIT",
          changedById: session.sub,
          changedByEmail: auth.actorEmail ?? session.email,
          organiserVerified: session.verified,
          statusAtChange: effectiveEventStatus(event),
          changes: [{
            field: "categories",
            label: EVENT_FIELD_LABELS.categories,
            from: existingDivisions,
            to: next,
            material: false,
          }],
        });
      }
      for (const u of updates) {
        await tx.registration.update({ where: { id: u.id }, data: u.data });
      }
    });
  }

  return NextResponse.json({
    divisions: [...existingDivisions, ...addedDivisions],
    updated: updates.length,
    unmatched: unmatched.map((r) => r.athleteEmail ?? r.registrationId ?? "unknown"),
    invalidTimes,
  });
}
