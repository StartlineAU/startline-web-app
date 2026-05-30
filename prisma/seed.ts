/**
 * Seed script — creates realistic test data for local / staging testing.
 *
 * Run with:  npx ts-node --compiler-options '{"module":"CommonJS"}' prisma/seed.ts
 * Or:        npm run prisma:seed   (if configured in package.json)
 *
 * IMPORTANT: This is destructive for the seeded organiser and their events.
 * It uses upsert so running it multiple times is safe.
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// ── Seed identifiers ─────────────────────────────────────────────────────────
const SEED_ORGANISER_SUB   = "seed-organiser-cognito-sub-001";
const SEED_ORGANISER_EMAIL = "test.organiser@startlineau.com";

async function main() {
  console.log("🌱 Seeding database…\n");

  // ── 1. Organiser ─────────────────────────────────────────────────────────
  // Look up by email first: an account with this email may already exist under
  // a different cognitoSub (e.g. from an earlier seed), which would otherwise
  // trip the unique-email constraint on insert.
  const existingOrganiser = await prisma.organiser.findUnique({
    where: { email: SEED_ORGANISER_EMAIL },
    select: { cognitoSub: true },
  });
  const organiserKey = existingOrganiser?.cognitoSub ?? SEED_ORGANISER_SUB;

  const organiser = await prisma.organiser.upsert({
    where:  { cognitoSub: organiserKey },
    update: {},
    create: {
      cognitoSub:   SEED_ORGANISER_SUB,
      email:        SEED_ORGANISER_EMAIL,
      status:       "APPROVED",

      // Profile
      orgName:      "Apex Endurance Events",
      contactName:  "James Hartley",
      contactEmail: "james@apexendurance.com.au",
      phone:        "+61 412 345 678",
      abn:          "51 824 753 556",
      website:      "https://apexendurance.com.au",
      instagram:    "apexenduranceevents",
      bio:          "Apex Endurance Events has been running community-first fitness competitions across Victoria and New South Wales since 2019. We specialise in functional fitness throwdowns, hybrid obstacle races, and team-based challenges that welcome athletes of all levels.",

      // Compliance & Stripe
      legalName:               "James Robert Hartley",
      insuranceDeclared:       true,
      stripeAccountId:         "acct_seed_test_1234xyz",
      stripeOnboardingComplete: true,
    },
  });

  console.log(`✓ Organiser: ${organiser.orgName} (${organiser.id})`);

  // ── 2. Events ─────────────────────────────────────────────────────────────

  // ── Event 1: APPROVED — "The Apex Throwdown 2026" ────────────────────────
  const event1 = await prisma.event.upsert({
    where:  { id: "seed-event-001-apex-throwdown" },
    update: {
      status:            "APPROVED",
      registrationCount: 24,
    },
    create: {
      id:           "seed-event-001-apex-throwdown",
      organiserId:  organiser.id,
      status:       "APPROVED",

      // Step 1 — basics
      title:       "The Apex Throwdown 2026",
      discipline:  "functional_fitness",
      tagline:     "Two days. One leaderboard. Every rep counts.",
      description: "The Apex Throwdown is Victoria's premier functional fitness competition, drawing over 300 athletes from across Australia. Three workouts across two days test your strength, conditioning, and mental grit. Scaled, RX, and Elite divisions. Team and individual options available.\n\nPrize pool of $8,000 across all divisions. Online workouts release 6 weeks prior for qualifier selection.",

      // Step 2 — date & location
      eventDate: "2026-08-15",
      endDate:   "2026-08-16",
      startTime: "07:30",
      endTime:   "17:00",
      venue:     "Melbourne Sports & Aquatic Centre",
      address:   "Albert Road, Albert Park",
      city:      "Melbourne",
      state:     "vic",

      // Step 3 — format & categories
      format:     "both",
      level:      "open",
      categories: ["Individual Scaled", "Individual RX", "Individual Elite", "Team of 2 Scaled", "Team of 2 RX", "Masters 35–44", "Masters 45+"],
      cap:        320,
      minAge:     16,

      // Step 4 — tickets
      waves: [
        { label: "Early Bird",  date: "2026-05-01", price: "95",  qty: 80  },
        { label: "General",     date: "2026-06-15", price: "115", qty: 150 },
        { label: "Late Entry",  date: "2026-07-31", price: "135", qty: 90  },
      ],
      inclusions:       "Event t-shirt, finisher medal, post-event athlete party, online score tracking, professional photography package",
      extras:           "Spectator tickets available at the door — $15/day. Parking at MSAC: $12/day.",
      activations:      "Vendor expo Friday evening. Supplement samples, apparel pop-ups, nutrition talks 9am Saturday.",
      refundPolicy:     "Moderate",
      registrationType: "startline",
      feeStructure:     "athlete",
      registrationCount: 24,

      // Step 5 — media
      coverImageUrl:    "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=1200&q=80",
      bagDrop:          "Bag drop available at Gate 3 from 6:45am both days. Bags must be tagged — tags provided at registration desk.",
      parking:          "MSAC car park: $12/day (Albert Road entrance). Street parking available on Aughtie Drive (free, limited).",
      accessibilityInfo: "Fully wheelchair accessible venue. Accessible toilets on all levels. Service animals welcome. Contact us for specific requirements.",
      additionalNotes:  "Athletes must check in at the registration desk before 8:00am on their competition day. Photo ID required.",

      isPinned: true,
    },
  });

  console.log(`✓ Event 1 (APPROVED): ${event1.title}`);

  // ── Event 2: PENDING — "Hybrid Hustle Series — Round 3" ──────────────────
  const event2 = await prisma.event.upsert({
    where:  { id: "seed-event-002-hybrid-hustle" },
    update: {},
    create: {
      id:          "seed-event-002-hybrid-hustle",
      organiserId: organiser.id,
      status:      "PENDING",

      title:       "Hybrid Hustle Series — Round 3",
      discipline:  "hybrid",
      tagline:     "Run. Lift. Repeat. The full package.",
      description: "Round 3 of the Hybrid Hustle Series hits the Dandenong Ranges. Expect trail running, loaded carries, obstacle crawls, and a surprise finale workout. Suitable for athletes comfortable with both running and functional fitness.",

      eventDate: "2026-09-06",
      startTime: "08:00",
      endTime:   "14:00",
      venue:     "Kokoda Track Memorial Walkway",
      address:   "Tirhatuan Drive",
      city:      "Scoresby",
      state:     "vic",

      format:     "individual",
      level:      "open",
      categories: ["Open Male", "Open Female", "Masters 40+"],
      cap:        150,
      minAge:     16,

      waves: [
        { label: "General Entry", date: "2026-07-01", price: "75", qty: 150 },
      ],
      inclusions:       "Race entry, finisher medal, recovery snack bag",
      refundPolicy:     "Flexible",
      registrationType: "startline",
      feeStructure:     "athlete",

      coverImageUrl: "https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?w=1200&q=80",
    },
  });

  console.log(`✓ Event 2 (PENDING):  ${event2.title}`);

  // ── Event 3: PENDING — "Coastline CrossFit Classic" ──────────────────────
  const event3 = await prisma.event.upsert({
    where:  { id: "seed-event-003-coastline-crossfit" },
    update: {},
    create: {
      id:          "seed-event-003-coastline-crossfit",
      organiserId: organiser.id,
      status:      "PENDING",

      title:       "Coastline CrossFit Classic",
      discipline:  "crossfit",
      tagline:     "Beach vibes. Competition standards.",
      description: "The Coastline CrossFit Classic returns to the Gold Coast for its third year. Three workouts across one big day with ocean views, live DJ, and one of the best communities in Australian CrossFit. All athletes must be current CrossFit members.",

      eventDate: "2026-10-03",
      startTime: "07:00",
      endTime:   "16:30",
      venue:     "Broadbeach Bowls Club Function Centre",
      address:   "19 Victoria Avenue",
      city:      "Broadbeach",
      state:     "qld",

      format:     "individual",
      level:      "open",
      categories: ["Scaled", "RX", "Elite / Affiliate Cup"],
      cap:        200,
      minAge:     16,

      waves: [
        { label: "Early Bird", date: "2026-07-15", price: "89",  qty: 60  },
        { label: "Standard",   date: "2026-09-01", price: "109", qty: 140 },
      ],
      inclusions:       "Comp shirt, finisher medal, post-event drinks (2 included)",
      refundPolicy:     "Moderate",
      registrationType: "startline",
      feeStructure:     "organiser",

      coverImageUrl: "https://images.unsplash.com/photo-1577221084712-45b0445d2b00?w=1200&q=80",
    },
  });

  console.log(`✓ Event 3 (PENDING):  ${event3.title}`);

  // ── Event 4: DRAFT — "Team Throwdown Summer Series" ──────────────────────
  const event4 = await prisma.event.upsert({
    where:  { id: "seed-event-004-team-throwdown" },
    update: {},
    create: {
      id:          "seed-event-004-team-throwdown",
      organiserId: organiser.id,
      status:      "DRAFT",

      title:       "Team Throwdown Summer Series",
      discipline:  "functional_fitness",
      tagline:     "",
      description: "Draft — details TBC",

      eventDate: "2026-12-05",
      startTime: "09:00",
      endTime:   "15:00",
      venue:     "TBC",
      city:      "Sydney",
      state:     "nsw",

      format:     "team",
      level:      "open",
      categories: [],
      waves:      [],
      registrationType: "startline",
      feeStructure:     "athlete",
    },
  });

  console.log(`✓ Event 4 (DRAFT):    ${event4.title}`);

  // ── Event 5: REJECTED ─────────────────────────────────────────────────────
  const event5 = await prisma.event.upsert({
    where:  { id: "seed-event-005-rejected" },
    update: {},
    create: {
      id:          "seed-event-005-rejected",
      organiserId: organiser.id,
      status:      "REJECTED",

      title:       "Autumn Run Festival",
      discipline:  "running",
      tagline:     "5K, 10K and half marathon through the Yarra Valley",
      description: "A scenic trail run through the Yarra Valley vineyards.",

      eventDate: "2026-04-11",
      startTime: "07:30",
      endTime:   "13:00",
      venue:     "Yering Station",
      address:   "38 Melba Highway",
      city:      "Yering",
      state:     "vic",

      format:     "individual",
      level:      "open",
      categories: ["5K", "10K", "Half Marathon"],
      cap:        500,
      waves: [
        { label: "5K Entry",        date: "2026-02-01", price: "45" },
        { label: "10K Entry",       date: "2026-02-01", price: "55" },
        { label: "Half Marathon",   date: "2026-02-01", price: "75" },
      ],
      registrationType:  "startline",
      feeStructure:      "athlete",
      refundPolicy:      "Firm",
      rejectionReason:   "Event date has already passed. Please resubmit with an upcoming event date.",
      reviewedAt:        new Date("2026-04-01T09:00:00Z"),
    },
  });

  console.log(`✓ Event 5 (REJECTED): ${event5.title}`);

  // ── 3. Reviews on the approved event ─────────────────────────────────────
  const reviewsData = [
    {
      id:           "seed-review-001",
      reviewerName: "Sarah K.",
      title:        "Best competition I've done all year",
      body:         "Incredibly well run from start to finish. The workouts were tough but fair, the venue was brilliant, and the team vibe was unreal. Already registered for next year.",
      overallRating:       5,
      communicationRating: 5,
      organisationRating:  5,
      experienceRating:    5,
      eventTitle:   event1.title,
      isVerified:   true,
      isPublished:  true,
    },
    {
      id:           "seed-review-002",
      reviewerName: "Tom R.",
      title:        "Great event, minor timing hiccups",
      body:         "Really enjoyed the event overall. Workouts were programming were spot on and the venue couldn't have been better. Had a 20 minute delay in the afternoon session but James and the team handled it professionally and kept everyone updated.",
      overallRating:       4,
      communicationRating: 5,
      organisationRating:  4,
      experienceRating:    4,
      eventTitle:   event1.title,
      isVerified:   true,
      isPublished:  true,
    },
    {
      id:           "seed-review-003",
      reviewerName: "Brooke M.",
      title:        "Absolutely worth the trip from Brisbane",
      body:         "Flew down just for this one and zero regrets. The Masters division is really well supported here — not an afterthought like at some other comps. The athlete party on Saturday night was a bonus I didn't expect.",
      overallRating:       5,
      communicationRating: 4,
      organisationRating:  5,
      experienceRating:    5,
      eventTitle:   event1.title,
      isVerified:   false,
      isPublished:  true,
    },
    {
      id:           "seed-review-004",
      reviewerName: "Liam O.",
      title:        "Solid community comp",
      body:         "Good event. Workouts were fun, judges were consistent, and the merch was a step up from last year. Would prefer earlier heat times for the scaled division — we didn't finish until nearly 5pm.",
      overallRating:       4,
      communicationRating: 3,
      organisationRating:  4,
      experienceRating:    4,
      eventTitle:   event1.title,
      isVerified:   true,
      isPublished:  true,
    },
  ];

  for (const r of reviewsData) {
    await prisma.review.upsert({
      where:  { id: r.id },
      update: {},
      create: {
        id:          r.id,
        organiserId: organiser.id,
        eventId:     event1.id,
        eventTitle:  r.eventTitle,
        reviewerName:        r.reviewerName,
        title:               r.title,
        body:                r.body,
        overallRating:       r.overallRating,
        communicationRating: r.communicationRating,
        organisationRating:  r.organisationRating,
        experienceRating:    r.experienceRating,
        isVerified:          r.isVerified,
        isPublished:         r.isPublished,
      },
    });
    console.log(`  ✓ Review: "${r.title}" by ${r.reviewerName}`);
  }

  // ── 4. Registrations on the approved event ───────────────────────────────
  // Startline fee per entry: 3% + $1, stored in integer cents.
  const platformFeeCents = (amountCents: number) =>
    Math.round(amountCents * 0.03) + 100;

  const athleteNames = [
    "Sarah Kovac", "Tom Rendell", "Brooke Mitchell", "Liam O'Connor",
    "Priya Nair", "Daniel Cho", "Emma Whitfield", "Jack Donovan",
    "Mia Fontaine", "Noah Pereira", "Chloe Bennett", "Ethan Walsh",
    "Ava Lindqvist", "Lucas Romano", "Grace Ferguson", "Oliver Tan",
    "Zoe Castellano", "Harry Maddox", "Isla Petrova", "Ben Castle",
    "Ruby Hayashi", "Marcus Webb", "Layla Ahmadi", "Finn Gallagher",
  ];
  const waveOptions = [
    { label: "Early Bird", price: 95 },
    { label: "General",    price: 115 },
    { label: "Late Entry", price: 135 },
  ];
  const categories: string[] = Array.isArray(event1.categories)
    ? (event1.categories as string[])
    : ["Individual RX"];

  let regCount = 0;
  for (let i = 0; i < athleteNames.length; i++) {
    const name = athleteNames[i];
    const wave = waveOptions[i % waveOptions.length];
    const category = categories[i % categories.length];
    const amountCents = wave.price * 100;
    const email = name.toLowerCase().replace(/[^a-z]+/g, ".") + "@example.com";

    await prisma.registration.upsert({
      where:  { id: `seed-reg-${String(i + 1).padStart(3, "0")}` },
      update: {},
      create: {
        id:               `seed-reg-${String(i + 1).padStart(3, "0")}`,
        eventId:          event1.id,
        organiserId:      organiser.id,
        athleteName:      name,
        athleteEmail:     email,
        category,
        waveLabel:        wave.label,
        amountCents,
        platformFeeCents: platformFeeCents(amountCents),
        feeStructure:     "athlete",
        status:           "CONFIRMED",
      },
    });
    regCount++;
  }

  // Keep the denormalised counter in sync with the seeded registrations.
  await prisma.event.update({
    where: { id: event1.id },
    data:  { registrationCount: regCount },
  });
  console.log(`  ✓ Registrations: ${regCount} confirmed entries on ${event1.title}`);

  // ── Summary ───────────────────────────────────────────────────────────────
  console.log(`
✅ Seed complete.

Test organiser login:
  Email:         ${SEED_ORGANISER_EMAIL}
  Cognito sub:   ${SEED_ORGANISER_SUB}
  (Create this user in your Cognito User Pool to log in via the UI)

Events created:
  APPROVED  (24 registrations) — The Apex Throwdown 2026       [id: seed-event-001-apex-throwdown]
  PENDING                      — Hybrid Hustle Series Round 3   [id: seed-event-002-hybrid-hustle]
  PENDING                      — Coastline CrossFit Classic      [id: seed-event-003-coastline-crossfit]
  DRAFT                        — Team Throwdown Summer Series   [id: seed-event-004-team-throwdown]
  REJECTED                     — Autumn Run Festival             [id: seed-event-005-rejected]

Reviews:        4 reviews on the approved event (average 4.5★)
Registrations:  24 confirmed entries on the approved event
`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
