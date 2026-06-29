-- CreateTable
CREATE TABLE "event_categories" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isCustom" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "event_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event_waves" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "priceCents" INTEGER NOT NULL DEFAULT 0,
    "closesAt" TIMESTAMP(3),
    "capacity" INTEGER,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "event_waves_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "event_categories_eventId_idx" ON "event_categories"("eventId");

-- CreateIndex
CREATE UNIQUE INDEX "event_categories_eventId_name_key" ON "event_categories"("eventId", "name");

-- CreateIndex
CREATE INDEX "event_waves_eventId_idx" ON "event_waves"("eventId");

-- CreateIndex
CREATE UNIQUE INDEX "event_waves_eventId_label_key" ON "event_waves"("eventId", "label");

-- AddForeignKey
ALTER TABLE "event_categories" ADD CONSTRAINT "event_categories_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "event_formats"("eventId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_waves" ADD CONSTRAINT "event_waves_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "event_tickets"("eventId") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill categories from JSON
INSERT INTO "event_categories" ("id", "eventId", "name", "sortOrder", "isCustom")
SELECT gen_random_uuid()::text, ef."eventId", cat.value, (cat.ordinality - 1)::int, false
FROM "event_formats" ef,
     jsonb_array_elements_text(ef."categories"::jsonb) WITH ORDINALITY AS cat(value, ordinality)
WHERE jsonb_array_length(ef."categories"::jsonb) > 0;

-- Backfill waves from JSON (unifies closes + date fields)
INSERT INTO "event_waves" ("id", "eventId", "label", "priceCents", "closesAt", "capacity", "sortOrder")
SELECT
    gen_random_uuid()::text,
    et."eventId",
    w->>'label',
    (COALESCE(NULLIF(w->>'price', ''), '0')::numeric * 100)::int,
    CASE
        WHEN COALESCE(NULLIF(w->>'closes', ''), NULLIF(w->>'date', '')) IS NOT NULL
        THEN (COALESCE(w->>'closes', w->>'date'))::timestamp
        ELSE NULL
    END,
    CASE
        WHEN w->>'qty' IS NOT NULL AND w->>'qty' != '' THEN (w->>'qty')::int
        ELSE NULL
    END,
    (ordinality - 1)::int
FROM "event_tickets" et,
     jsonb_array_elements(et."waves"::jsonb) WITH ORDINALITY AS t(w, ordinality)
WHERE jsonb_array_length(et."waves"::jsonb) > 0;
