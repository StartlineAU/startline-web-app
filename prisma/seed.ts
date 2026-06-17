/**
 * Seed script — creates realistic test data for local / staging testing.
 *
 * Run with:  npx prisma db seed
 *
 * IMPORTANT: This is destructive — it wipes then recreates all seed data.
 * Uses upsert so running it multiple times is safe.
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// ── Seed identifiers ─────────────────────────────────────────────────────────
const SEED_ORGANISER_SUB   = "seed-organiser-cognito-sub-001";
const SEED_ORGANISER_EMAIL = "test.organiser@startlineau.com";

const COASTAL_ORG_SUB   = "coastal-trail-sub";
const COASTAL_ORG_EMAIL = "hello@coastaltrailrunning.com.au";

const URBAN_ORG_SUB   = "urban-fitness-sub";
const URBAN_ORG_EMAIL = "info@urbanfitnessevents.com.au";

async function main() {
  console.log("🌱 Seeding database…\n");

  // ── Wipe existing seed data (FK order) ──────────────────────────────────
  await prisma.registration.deleteMany();
  await prisma.review.deleteMany();
  await prisma.announcement.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.event.deleteMany();
  await prisma.admin.deleteMany();
  await prisma.organiser.deleteMany();
  console.log("  Cleared existing data");

  // ── Admin (cognitoSub matches dev bypass) ────────────────────────────────
  const admin = await prisma.admin.create({
    data: {
      cognitoSub: SEED_ORGANISER_SUB,
      email: SEED_ORGANISER_EMAIL,
      name: "Platform Admin",
    },
  });
  console.log(`  Admin: ${admin.email}`);

  // ─────────────────────────────────────────────────────────────────────────
  // 1. Organiser — Apex Endurance Events
  // ─────────────────────────────────────────────────────────────────────────
  const apexOrg = await prisma.organiser.upsert({
    where:  { cognitoSub: SEED_ORGANISER_SUB },
    update: {},
    create: {
      cognitoSub:   SEED_ORGANISER_SUB,
      email:        SEED_ORGANISER_EMAIL,
      status:       "APPROVED",

      orgName:      "Apex Endurance Events",
      contactName:  "James Hartley",
      contactEmail: "james@apexendurance.com.au",
      phone:        "+61 412 345 678",
      abn:          "51 824 753 556",
      website:      "https://apexendurance.com.au",
      instagram:    "apexenduranceevents",
      bio:          "Apex Endurance Events has been running community-first fitness competitions across Victoria and New South Wales since 2019. We specialise in functional fitness throwdowns, hybrid obstacle races, and team-based challenges that welcome athletes of all levels.",

      legalName:               "James Robert Hartley",
      insuranceDeclared:       true,
      stripeAccountId:         "acct_seed_test_1234xyz",
      stripeOnboardingComplete: true,
      photos:                  [],
    },
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 2. Organiser — Coastal Trail Running
  // ─────────────────────────────────────────────────────────────────────────
  const coastalOrg = await prisma.organiser.create({
    data: {
      cognitoSub:   COASTAL_ORG_SUB,
      email:        COASTAL_ORG_EMAIL,
      status:       "APPROVED",

      orgName:      "Coastal Trail Running",
      contactName:  "Sarah Mitchell",
      contactEmail: "sarah@coastaltrailrunning.com.au",
      phone:        "0411 222 333",
      abn:          "98 765 432 109",
      website:      "https://coastaltrailrunning.com.au",
      instagram:    "@coastal_trail",
      facebook:     "coastaltrailrunning",
      bio:          "Australia's premier trail running event organisers. From coastal paths to mountain peaks, we bring you the best trail running experiences on the east coast.",
      photos:       [],
    },
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 3. Organiser — Urban Fitness Events
  // ─────────────────────────────────────────────────────────────────────────
  const urbanOrg = await prisma.organiser.create({
    data: {
      cognitoSub:   URBAN_ORG_SUB,
      email:        URBAN_ORG_EMAIL,
      status:       "APPROVED",

      orgName:      "Urban Fitness Events",
      contactName:  "Mike Chen",
      contactEmail: "mike@urbanfitnessevents.com.au",
      phone:        "0422 333 444",
      abn:          "45 678 901 234",
      website:      "https://urbanfitnessevents.com.au",
      instagram:    "@urban_fitness_events",
      facebook:     "urbanfitnessevents",
      bio:          "Bringing fitness to the city. We organise urban running events, park runs, and community fitness challenges across Australia's major cities.",
      photos:       [],
    },
  });

  console.log(`  Organisers: ${apexOrg.orgName}, ${coastalOrg.orgName}, ${urbanOrg.orgName}`);

  // ─────────────────────────────────────────────────────────────────────────
  // Apex Events
  // ─────────────────────────────────────────────────────────────────────────

  // Apex Event 1: APPROVED — "The Apex Throwdown 2026"
  const apexEvent1 = await prisma.event.upsert({
    where:  { id: "seed-event-001-apex-throwdown" },
    update: {
      status: "APPROVED",
    },
    create: {
      id:           "seed-event-001-apex-throwdown",
      organiserId:  apexOrg.id,
      status:       "APPROVED",

      title:       "The Apex Throwdown 2026",
      discipline:  "functional_fitness",
      tagline:     "Two days. One leaderboard. Every rep counts.",
      description: "The Apex Throwdown is Victoria's premier functional fitness competition, drawing over 300 athletes from across Australia. Three workouts across two days test your strength, conditioning, and mental grit. Scaled, RX, and Elite divisions. Team and individual options available.\n\nPrize pool of $8,000 across all divisions. Online workouts release 6 weeks prior for qualifier selection.",

      eventDate: "2026-08-15",
      endDate:   "2026-08-16",
      startTime: "07:30",
      endTime:   "17:00",
      venue:     "Melbourne Sports & Aquatic Centre",
      address:   "Albert Road, Albert Park",
      city:      "Melbourne",
      state:     "vic",

      format:     "both",
      level:      "open",
      categories: ["Individual Scaled", "Individual RX", "Individual Elite", "Team of 2 Scaled", "Team of 2 RX", "Masters 35\u201344", "Masters 45+"],
      cap:        320,
      minAge:     16,

      waves: [
        { label: "Early Bird",  date: "2026-05-01", price: "95",  qty: 80  },
        { label: "General",     date: "2026-06-15", price: "115", qty: 150 },
        { label: "Late Entry",  date: "2026-07-31", price: "135", qty: 90  },
      ],
      inclusions:       "Event t-shirt, finisher medal, post-event athlete party, online score tracking, professional photography package",
      extras:           "Spectator tickets available at the door \u2014 $15/day. Parking at MSAC: $12/day.",
      activations:      "Vendor expo Friday evening. Supplement samples, apparel pop-ups, nutrition talks 9am Saturday.",
      refundPolicy:     "Moderate",
      registrationType: "startline",
      feeStructure:     "athlete",
      coverImageUrl:    "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=1200&q=80",
      bagDrop:          "Bag drop available at Gate 3 from 6:45am both days. Bags must be tagged \u2014 tags provided at registration desk.",
      parking:          "MSAC car park: $12/day (Albert Road entrance). Street parking available on Aughtie Drive (free, limited).",
      accessibilityInfo: "Fully wheelchair accessible venue. Accessible toilets on all levels. Service animals welcome. Contact us for specific requirements.",
      additionalNotes:  "Athletes must check in at the registration desk before 8:00am on their competition day. Photo ID required.",
    },
  });

  // Apex Event 2: PENDING — "Hybrid Hustle Series \u2014 Round 3"
  const apexEvent2 = await prisma.event.upsert({
    where:  { id: "seed-event-002-hybrid-hustle" },
    update: {},
    create: {
      id:          "seed-event-002-hybrid-hustle",
      organiserId: apexOrg.id,
      status:      "PENDING",

      title:       "Hybrid Hustle Series \u2014 Round 3",
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

  // Apex Event 3: PENDING — "Coastline CrossFit Classic"
  const apexEvent3 = await prisma.event.upsert({
    where:  { id: "seed-event-003-coastline-crossfit" },
    update: {},
    create: {
      id:          "seed-event-003-coastline-crossfit",
      organiserId: apexOrg.id,
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

  // Apex Event 4: DRAFT — "Team Throwdown Summer Series"
  const apexEvent4 = await prisma.event.upsert({
    where:  { id: "seed-event-004-team-throwdown" },
    update: {},
    create: {
      id:          "seed-event-004-team-throwdown",
      organiserId: apexOrg.id,
      status:      "DRAFT",

      title:       "Team Throwdown Summer Series",
      discipline:  "functional_fitness",
      tagline:     "",
      description: "Draft \u2014 details TBC",

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

  // Apex Event 5: REJECTED — "Autumn Run Festival"
  const apexEvent5 = await prisma.event.upsert({
    where:  { id: "seed-event-005-rejected" },
    update: {},
    create: {
      id:          "seed-event-005-rejected",
      organiserId: apexOrg.id,
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

  console.log(`  Events (Apex): ${apexEvent1.title.split(" ")[0]}… (5 total)`);

  // ─────────────────────────────────────────────────────────────────────────
  // Coastal Trail Events
  // ─────────────────────────────────────────────────────────────────────────

  const coastalEvent1 = await prisma.event.create({
    data: {
      organiserId: coastalOrg.id,
      status: "APPROVED",
      title: "Byron Bay Trail Run",
      discipline: "trail",
      tagline: "Run the stunning Byron Bay hinterland trails",
      description: "A scenic 10km and 21km trail run through the Byron Bay hinterland. Experience breathtaking coastal views, lush rainforest sections, and finish on the iconic Byron Bay beach.",
      eventDate: "2026-04-15",
      startTime: "07:00",
      endTime: "12:00",
      venue: "Byron Bay Regional Park",
      address: "25 Broken Head Rd",
      city: "Byron Bay",
      state: "NSW",
      format: "point-to-point",
      level: "intermediate",
      categories: ["10km", "21km half marathon"],
      cap: 500,
      waves: [
        { label: "Early Bird", date: "2026-02-01", price: "65", qty: 100 },
        { label: "Standard",   date: "2026-03-01", price: "85", qty: 300 },
      ],
      inclusions: "Race bib, timing chip, finisher medal, post-race breakfast",
      registrationType: "startline",
      feeStructure: "athlete",
    },
  });

  const coastalEvent2 = await prisma.event.create({
    data: {
      organiserId: coastalOrg.id,
      status: "PENDING",
      title: "Sydney Harbour 10K",
      discipline: "road",
      tagline: "Run past the Sydney Opera House at sunrise",
      description: "A flat, fast 10km course along Sydney Harbour. Start at Mrs Macquaries Point, run past the Opera House, under the Harbour Bridge.",
      eventDate: "2026-08-20",
      startTime: "06:30",
      endTime: "09:00",
      venue: "Mrs Macquaries Point",
      city: "Sydney",
      state: "NSW",
      format: "loop",
      level: "beginner",
      categories: ["10km"],
      cap: 1000,
      waves: [
        { label: "Early Bird", date: "2026-06-01", price: "45", qty: 300 },
        { label: "Standard",   date: "2026-07-15", price: "65", qty: 500 },
      ],
      inclusions: "Race bib, timing chip, finisher medal",
      registrationType: "startline",
      feeStructure: "athlete",
    },
  });

  const coastalEvent3 = await prisma.event.create({
    data: {
      organiserId: coastalOrg.id,
      status: "DRAFT",
      title: "Blue Mountains Marathon",
      discipline: "trail",
      tagline: "Conquer the iconic Blue Mountains trails",
      description: "A challenging marathon distance trail run through the Blue Mountains National Park.",
      eventDate: "2026-10-10",
      startTime: "05:00",
      endTime: "17:00",
      venue: "Katoomba Showground",
      city: "Katoomba",
      state: "NSW",
      format: "point-to-point",
      level: "advanced",
      categories: ["Full marathon 42.2km", "Ultra 50km"],
      cap: 300,
      minAge: 18,
      waves: [
        { label: "Early Bird", date: "2026-07-01", price: "150", qty: 150 },
        { label: "Standard",   date: "2026-09-15", price: "180", qty: 150 },
      ],
      inclusions: "Race bib, timing chip, finisher medal, finisher jacket",
      registrationType: "startline",
      feeStructure: "athlete",
    },
  });

  console.log(`  Events (Coastal): 3 created`);

  // ─────────────────────────────────────────────────────────────────────────
  // Urban Fitness Events
  // ─────────────────────────────────────────────────────────────────────────

  const urbanEvent1 = await prisma.event.create({
    data: {
      organiserId: urbanOrg.id,
      status: "APPROVED",
      title: "Melbourne City Park Run",
      discipline: "road",
      tagline: "Run through Melbourne's iconic parklands",
      description: "A 5km and 10km course through the Royal Botanic Gardens and Kings Domain.",
      eventDate: "2026-06-14",
      startTime: "08:00",
      endTime: "11:00",
      venue: "Shrine of Remembrance",
      city: "Melbourne",
      state: "VIC",
      format: "loop",
      level: "beginner",
      categories: ["5km", "10km", "Kids dash 1km"],
      cap: 800,
      minAge: 4,
      waves: [
        { label: "Early Bird", date: "2026-04-01", price: "35", qty: 300 },
        { label: "Standard",   date: "2026-05-15", price: "50", qty: 400 },
      ],
      inclusions: "Race bib, finisher medal",
      registrationType: "startline",
      feeStructure: "athlete",
    },
  });

  const urbanEvent2 = await prisma.event.create({
    data: {
      organiserId: urbanOrg.id,
      status: "DRAFT",
      title: "Brisbane River Run",
      discipline: "road",
      tagline: "Follow the Brisbane River from South Bank to New Farm",
      description: "A scenic riverside run through the heart of Brisbane.",
      eventDate: "2026-09-20",
      startTime: "06:30",
      endTime: "10:00",
      venue: "South Bank Parklands",
      city: "Brisbane",
      state: "QLD",
      format: "out-and-back",
      level: "beginner",
      categories: ["5km", "10km", "Half marathon 21.1km"],
      cap: 600,
      waves: [
        { label: "Standard", date: "2026-08-15", price: "55", qty: 400 },
        { label: "Late",     date: "2026-09-15", price: "70", qty: 200 },
      ],
      inclusions: "Race bib, timing chip, finisher medal, post-race BBQ",
      registrationType: "startline",
      feeStructure: "athlete",
    },
  });

  console.log(`  Events (Urban): 2 created`);

  // ─────────────────────────────────────────────────────────────────────────
  // Reviews
  // ─────────────────────────────────────────────────────────────────────────

  await prisma.review.upsert({
    where:  { id: "seed-review-001" },
    update: {},
    create: {
      id:           "seed-review-001",
      organiserId:  apexOrg.id,
      eventId:      apexEvent1.id,
      eventTitle:   apexEvent1.title,
      reviewerName: "Sarah K.",
      title:        "Best competition I've done all year",
      body:         "Incredibly well run from start to finish. The workouts were tough but fair, the venue was brilliant, and the team vibe was unreal.",
      overallRating:       5,
      communicationRating: 5,
      organisationRating:  5,
      experienceRating:    5,
      isVerified:   true,
    },
  });

  await prisma.review.upsert({
    where:  { id: "seed-review-002" },
    update: {},
    create: {
      id:           "seed-review-002",
      organiserId:  apexOrg.id,
      eventId:      apexEvent1.id,
      eventTitle:   apexEvent1.title,
      reviewerName: "Tom R.",
      title:        "Great event, minor timing hiccups",
      body:         "Really enjoyed the event overall. Had a 20 minute delay but the team handled it professionally.",
      overallRating:       4,
      communicationRating: 5,
      organisationRating:  4,
      experienceRating:    4,
      isVerified:   true,
    },
  });

  await prisma.review.upsert({
    where:  { id: "seed-review-003" },
    update: {},
    create: {
      id:           "seed-review-003",
      organiserId:  coastalOrg.id,
      eventId:      coastalEvent1.id,
      eventTitle:   coastalEvent1.title,
      reviewerName: "Alex T.",
      title:        "Absolutely stunning course!",
      body:         "The Byron Bay Trail Run was incredible. The course was well marked, the views breathtaking.",
      overallRating:       5,
      communicationRating: 5,
      organisationRating:  5,
      experienceRating:    4,
      isVerified:   true,
    },
  });

  await prisma.review.upsert({
    where:  { id: "seed-review-004" },
    update: {},
    create: {
      id:           "seed-review-004",
      organiserId:  urbanOrg.id,
      eventId:      urbanEvent1.id,
      eventTitle:   urbanEvent1.title,
      reviewerName: "David P.",
      title:        "Lovely morning run in the park",
      body:         "A well-organised community event. Great for families.",
      overallRating:       4,
      communicationRating: 4,
      organisationRating:  4,
      experienceRating:    4,
      isVerified:   true,
    },
  });

  console.log(`  Reviews: 4 created`);

  // ─────────────────────────────────────────────────────────────────────────
  // Registrations on the approved Apex event
  // ─────────────────────────────────────────────────────────────────────────

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

  const platformFeeCents = (amountCents: number) =>
    Math.round(amountCents * 0.03) + 100;

  let regCount = 0;
  for (let i = 0; i < athleteNames.length; i++) {
    const name = athleteNames[i];
    const wave = waveOptions[i % waveOptions.length];
    const amountCents = wave.price * 100;
    const email = name.toLowerCase().replace(/[^a-z]+/g, ".") + "@example.com";

    await prisma.registration.upsert({
      where:  { id: `seed-reg-${String(i + 1).padStart(3, "0")}` },
      update: {},
      create: {
        id:               `seed-reg-${String(i + 1).padStart(3, "0")}`,
        eventId:          apexEvent1.id,
        organiserId:      apexOrg.id,
        athleteName:      name,
        athleteEmail:     email,
        waveLabel:        wave.label,
        amountCents,
        platformFeeCents: platformFeeCents(amountCents),
        feeStructure:     "athlete",
        status:           "CONFIRMED",
      },
    });
    regCount++;
  }

  console.log(`  Registrations: ${regCount} on ${apexEvent1.title}`);

  // ─────────────────────────────────────────────────────────────────────────
  // Summary
  // ─────────────────────────────────────────────────────────────────────────

  console.log(`
✅ Seed complete.

Dev bypass login emails:
  ${SEED_ORGANISER_EMAIL}  (Apex Endurance Events — 5 events, 24 registrations)
  ${COASTAL_ORG_EMAIL}     (Coastal Trail Running — 3 events)
  ${URBAN_ORG_EMAIL}       (Urban Fitness Events — 2 events)
`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
