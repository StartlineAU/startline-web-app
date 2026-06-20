import { PrismaClient } from "@prisma/client";
import {
  CognitoIdentityProviderClient,
  AdminCreateUserCommand,
  AdminSetUserPasswordCommand,
  AdminAddUserToGroupCommand,
  ListUsersCommand,
  ListUsersInGroupCommand,
  UsernameExistsException,
} from "@aws-sdk/client-cognito-identity-provider";

const prisma = new PrismaClient();

const PASSWORD = "Password123!";

const region       = process.env.NEXT_PUBLIC_AWS_REGION ?? "ap-southeast-2";
const userPoolId   = process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID ?? "";
const userPoolName = userPoolId.split("_").pop() ?? "unknown";

const cognito = new CognitoIdentityProviderClient({ region });

type SeedUser = {
  email: string;
  group: "admins" | "organisers" | "customers";
  displayName: string;
};

const SEED_USERS: SeedUser[] = [
  // ── Admins ──
  { email: "admin@startlineau.com",               group: "admins",     displayName: "Platform Admin" },
  // ── Organisers ──
  { email: "test.organiser@startlineau.com",       group: "organisers", displayName: "James Hartley" },
  { email: "hello@coastaltrailrunning.com.au",     group: "organisers", displayName: "Sarah Mitchell" },
  { email: "info@urbanfitnessevents.com.au",       group: "organisers", displayName: "Mike Chen" },
  // ── Customers ──
  { email: "sarah.kovac@example.com",              group: "customers",   displayName: "Sarah Kovac" },
  { email: "tom.rendell@example.com",              group: "customers",   displayName: "Tom Rendell" },
  { email: "brooke.mitchell@example.com",          group: "customers",   displayName: "Brooke Mitchell" },
  { email: "liam.oconnor@example.com",             group: "customers",   displayName: "Liam O'Connor" },
];

type OrganiserProfile = {
  orgName: string;
  contactName: string;
  contactEmail: string;
  phone: string;
  abn: string;
  website?: string;
  instagram?: string;
  facebook?: string;
  bio: string;
};

const ORGANISER_PROFILES: Record<string, OrganiserProfile> = {
  "test.organiser@startlineau.com": {
    orgName:      "Apex Endurance Events",
    contactName:  "James Hartley",
    contactEmail: "james@apexendurance.com.au",
    phone:        "+61 412 345 678",
    abn:          "51 824 753 556",
    website:      "https://apexendurance.com.au",
    instagram:    "apexenduranceevents",
    bio:          "Apex Endurance Events has been running community-first fitness competitions across Victoria and New South Wales since 2019.",
  },
  "hello@coastaltrailrunning.com.au": {
    orgName:      "Coastal Trail Running",
    contactName:  "Sarah Mitchell",
    contactEmail: "sarah@coastaltrailrunning.com.au",
    phone:        "0411 222 333",
    abn:          "98 765 432 109",
    website:      "https://coastaltrailrunning.com.au",
    instagram:    "@coastal_trail",
    facebook:     "coastaltrailrunning",
    bio:          "Australia's premier trail running event organisers. From coastal paths to mountain peaks, we bring you the best trail running experiences on the east coast.",
  },
  "info@urbanfitnessevents.com.au": {
    orgName:      "Urban Fitness Events",
    contactName:  "Mike Chen",
    contactEmail: "mike@urbanfitnessevents.com.au",
    phone:        "0422 333 444",
    abn:          "45 678 901 234",
    website:      "https://urbanfitnessevents.com.au",
    instagram:    "@urban_fitness_events",
    facebook:     "urbanfitnessevents",
    bio:          "Bringing fitness to the city. We organise urban running events, park runs, and community fitness challenges across Australia's major cities.",
  },
};

async function ensureCognitoUsers(): Promise<void> {
  console.log("  Ensuring seed users exist in Cognito…");
  let created = 0;
  for (const user of SEED_USERS) {
    try {
      await cognito.send(new AdminCreateUserCommand({
        UserPoolId: userPoolId,
        Username: user.email,
        TemporaryPassword: PASSWORD,
        MessageAction: "SUPPRESS",
      }));
      created++;
    } catch (e) {
      if (!(e instanceof UsernameExistsException)) throw e;
    }

    await cognito.send(new AdminSetUserPasswordCommand({
      UserPoolId: userPoolId,
      Username: user.email,
      Password: PASSWORD,
      Permanent: true,
    }));

    await cognito.send(new AdminAddUserToGroupCommand({
      UserPoolId: userPoolId,
      Username: user.email,
      GroupName: user.group,
    }));
  }
  console.log(`  Cognito: ${created} created, ${SEED_USERS.length - created} already existed`);
}

async function fetchCognitoSubs(): Promise<{
  subsByEmail: Record<string, string>;
  groupMembers: Record<string, string[]>;
}> {
  const allUsers = await cognito.send(new ListUsersCommand({
    UserPoolId: userPoolId,
  }));

  const subsByEmail: Record<string, string> = {};

  for (const user of allUsers.Users ?? []) {
    const email = user.Attributes?.find(a => a.Name === "email")?.Value;
    const sub   = user.Username;
    if (email && sub) subsByEmail[email] = sub;
  }

  const groupMembers: Record<string, string[]> = {};
  for (const group of ["admins", "organisers", "customers"]) {
    const response = await cognito.send(new ListUsersInGroupCommand({
      UserPoolId: userPoolId,
      GroupName: group,
    }));
    groupMembers[group] = (response.Users ?? []).map(u => u.Username!);
  }

  return { subsByEmail, groupMembers };
}

async function main() {
  console.log("🌱 Seeding database…\n");

  if (!userPoolId) {
    console.error("  NEXT_PUBLIC_COGNITO_USER_POOL_ID not set in environment");
    process.exit(1);
  }

  await ensureCognitoUsers();

  const { subsByEmail, groupMembers } = await fetchCognitoSubs();
  console.log(`  Cognito users found: ${Object.keys(subsByEmail).length}`);

  const emailToSub = (email: string): string => {
    const sub = subsByEmail[email];
    if (!sub) throw new Error(`Cognito user not found: ${email}`);
    return sub;
  };

  await prisma.registration.deleteMany();
  await prisma.review.deleteMany();
  await prisma.announcement.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.event.deleteMany();
  await prisma.admin.deleteMany();
  await prisma.customer.deleteMany();
  await prisma.waitlistSubscriber.deleteMany();
  await prisma.organiser.deleteMany();
  console.log("  Cleared existing data");

  // ── Admin (from Cognito admins group) ─────────────────────────────────
  const adminSubs = groupMembers["admins"] ?? [];
  const adminRecords: { id: string; email: string; name: string | null }[] = [];

  for (const sub of adminSubs) {
    const email = SEED_USERS.find(u => subsByEmail[u.email] === sub)?.email ?? "unknown";
    const name  = SEED_USERS.find(u => subsByEmail[u.email] === sub)?.displayName ?? null;
    const record = await prisma.admin.create({
      data: { cognitoSub: sub, email, name },
    });
    adminRecords.push(record);
  }
  console.log(`  Admins: ${adminRecords.length}`);

  // ── Organisers (from Cognito organisers group) ────────────────────────
  const organiserSubs = groupMembers["organisers"] ?? [];
  const organiserRecords: { id: string; email: string; orgName: string | null; instagram: string | null; facebook: string | null }[] = [];

  for (const sub of organiserSubs) {
    const email = SEED_USERS.find(u => subsByEmail[u.email] === sub)?.email ?? "unknown";
    const profile = ORGANISER_PROFILES[email];

    const record = await prisma.organiser.create({
      data: {
        cognitoSub: sub,
        email,
        status: "APPROVED",
        orgName: profile?.orgName ?? email,
        contactName: profile?.contactName,
        contactEmail: profile?.contactEmail,
        phone: profile?.phone,
        abn: profile?.abn ?? "",
        website: profile?.website,
        instagram: profile?.instagram,
        facebook: profile?.facebook,
        bio: profile?.bio ?? "",
        photos: [],
      },
    });
    organiserRecords.push(record);
  }
  console.log(`  Organisers: ${organiserRecords.length}`);

  // ── Customers (from Cognito customers group) ──────────────────────────
  const customerSubs = groupMembers["customers"] ?? [];
  const customerByEmail: Record<string, string> = {};
  let customerCount = 0;

  for (const sub of customerSubs) {
    const email = SEED_USERS.find(u => subsByEmail[u.email] === sub)?.email ?? "unknown";
    const name  = SEED_USERS.find(u => subsByEmail[u.email] === sub)?.displayName ?? null;
    await prisma.customer.upsert({
      where: { cognitoSub: sub },
      update: {},
      create: { cognitoSub: sub, email, name },
    });
    customerByEmail[email] = sub;
    customerCount++;
  }
  console.log(`  Customers: ${customerCount}`);

  // ── Resolve seeded organisers by email ────────────────────────────────
  const apexOrg   = organiserRecords.find(r => r.email === "test.organiser@startlineau.com");
  const coastalOrg = organiserRecords.find(r => r.email === "hello@coastaltrailrunning.com.au");
  const urbanOrg   = organiserRecords.find(r => r.email === "info@urbanfitnessevents.com.au");

  if (!apexOrg || !coastalOrg || !urbanOrg) {
    console.error("  Missing required organiser records. Ensure all 3 organisers exist in Cognito.");
    process.exit(1);
  }

  const platformFeeCents = (amountCents: number) =>
    Math.round(amountCents * 0.0395) + 145;

  // ─────────────────────────────────────────────────────────────────────────
  // Apex Events
  // ─────────────────────────────────────────────────────────────────────────

  const apexEvent1 = await prisma.event.upsert({
    where:  { id: "seed-event-001-apex-throwdown" },
    update: { status: "APPROVED" },
    create: {
      id:           "seed-event-001-apex-throwdown",
      organiserId:  apexOrg.id,
      status:       "APPROVED",
      title:        "The Apex Throwdown 2026",
      discipline:   "functional_fitness",
      tagline:      "Two days. One leaderboard. Every rep counts.",
      description:  "The Apex Throwdown is Victoria's premier functional fitness competition, drawing over 300 athletes from across Australia. Three workouts across two days test your strength, conditioning, and mental grit. Scaled, RX, and Elite divisions. Team and individual options available.\n\nPrize pool of $8,000 across all divisions. Online workouts release 6 weeks prior for qualifier selection.",
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
      description: "Round 3 of the Hybrid Hustle Series hits the Dandenong Ranges. Expect trail running, loaded carries, obstacle crawls, and a surprise finale workout.",
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
      description: "The Coastline CrossFit Classic returns to the Gold Coast for its third year. Three workouts across one big day with ocean views, live DJ, and one of the best communities in Australian CrossFit.",
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
        { label: "5K Entry",      date: "2026-02-01", price: "45" },
        { label: "10K Entry",     date: "2026-02-01", price: "55" },
        { label: "Half Marathon", date: "2026-02-01", price: "75" },
      ],
      registrationType:  "startline",
      feeStructure:      "athlete",
      refundPolicy:      "Firm",
      rejectionReason:   "Event date has already passed. Please resubmit with an upcoming event date.",
      reviewedAt:        new Date("2026-04-01T09:00:00Z"),
    },
  });

  console.log(`  Events (Apex): 5 total`);

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
      description: "A scenic 10km and 21km trail run through the Byron Bay hinterland.",
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
      description: "A flat, fast 10km course along Sydney Harbour.",
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
      body:         "Incredibly well run from start to finish.",
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
      body:         "Really enjoyed the event overall.",
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
      body:         "The Byron Bay Trail Run was incredible.",
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

  const allInitialReviewIds = ["seed-review-001", "seed-review-002", "seed-review-003", "seed-review-004"];
  let reviewCount = allInitialReviewIds.length;
  console.log(`  Reviews: ${reviewCount} created`);

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
  // More registrations on other approved events
  // ─────────────────────────────────────────────────────────────────────────

  const byronAthletes = [
    "Sam Fletcher", "Jade O'Reilly", "Rory McIntyre", "Tessa Nguyen",
    "Haruki Sato", "Maya Patel", "Josh Blackwood", "Freya Johansson",
  ];

  for (let i = 0; i < byronAthletes.length; i++) {
    const name = byronAthletes[i];
    const wave = (coastalEvent1.waves as unknown as Array<{label: string; price: string}>)[i % 2];
    const amountCents = parseInt(wave.price) * 100;
    const email = name.toLowerCase().replace(/[^a-z]+/g, ".") + "@example.com";
    await prisma.registration.create({
      data: {
        eventId:          coastalEvent1.id,
        organiserId:      coastalOrg.id,
        athleteName:      name,
        athleteEmail:     email,
        category:         ((coastalEvent1.categories as string[] | null) ?? [])[i % 2],
        waveLabel:        wave.label,
        amountCents,
        platformFeeCents: platformFeeCents(amountCents),
        feeStructure:     "athlete",
        status:           i < 6 ? "CONFIRMED" : "CANCELLED",
        stripePaymentIntentId: i < 6 ? `pi_byron_001_${i}` : undefined,
      },
    });
  }
  let otherRegCount = byronAthletes.length;

  const melbAthletes = [
    "Angus McDonald", "Sophie Laurent", "Raj Kapoor", "Isabella Torres",
    "Connor Blake", "Hannah Yilmaz", "Leo Fitzgerald", "Amara Obi",
  ];

  for (let i = 0; i < melbAthletes.length; i++) {
    const name = melbAthletes[i];
    const wave = (urbanEvent1.waves as unknown as Array<{label: string; price: string}>)[i % 2];
    const amountCents = parseInt(wave.price) * 100;
    const email = name.toLowerCase().replace(/[^a-z]+/g, ".") + "@example.com";
    await prisma.registration.create({
      data: {
        eventId:          urbanEvent1.id,
        organiserId:      urbanOrg.id,
        athleteName:      name,
        athleteEmail:     email,
        category:         ((urbanEvent1.categories as string[] | null) ?? [])[i % 3],
        waveLabel:        wave.label,
        amountCents,
        platformFeeCents: platformFeeCents(amountCents),
        feeStructure:     "athlete",
        status:           "CONFIRMED",
        stripePaymentIntentId: `pi_melb_001_${i}`,
      },
    });
  }
  otherRegCount += melbAthletes.length;

  const extraApexRegs = [
    { name: "Nina Vasquez", email: "nina.vasquez@example.com", wave: "Early Bird", price: 95, status: "CANCELLED" as const },
    { name: "Dylan Cross", email: "dylan.cross@example.com", wave: "General", price: 115, status: "REFUNDED" as const },
    { name: "Aisha Kazemi", email: "aisha.kazemi@example.com", wave: "Late Entry", price: 135, status: "CONFIRMED" as const },
    { name: "Oscar De Luca", email: "oscar.deluca@example.com", wave: "Early Bird", price: 95, status: "CONFIRMED" as const },
  ];

  for (let i = 0; i < extraApexRegs.length; i++) {
    const r = extraApexRegs[i];
    const amountCents = r.price * 100;
    await prisma.registration.create({
      data: {
        eventId:          apexEvent1.id,
        organiserId:      apexOrg.id,
        athleteName:      r.name,
        athleteEmail:     r.email,
        waveLabel:        r.wave,
        amountCents,
        platformFeeCents: platformFeeCents(amountCents),
        feeStructure:     "athlete",
        status:           r.status,
        stripePaymentIntentId: `pi_apex_extra_${i}`,
      },
    });
  }
  otherRegCount += extraApexRegs.length;

  console.log(`  More registrations: ${otherRegCount} (Byron Bay, Melbourne Park Run, extra Apex)`);

  // ─────────────────────────────────────────────────────────────────────────
  // Waitlist Subscribers
  // ─────────────────────────────────────────────────────────────────────────

  const waitlistEmails = [
    "alex.turner@example.com", "bree.collins@example.com", "cameron.nguyen@example.com",
    "dana.wilson@example.com", "eli.patel@example.com", "fatima.hassan@example.com",
    "george.kim@example.com", "hannah.jones@example.com", "ivy.martin@example.com",
    "jack.thompson@example.com", "kara.adams@example.com", "leo.robinson@example.com",
    "maya.clarke@example.com", "nathan.wright@example.com", "olivia.lee@example.com",
    "peter.silva@example.com", "quincy.ng@example.com", "rose.taylor@example.com",
    "sam.anderson@example.com", "tara.murphy@example.com", "uma.jain@example.com",
    "vince.costa@example.com", "willow.hall@example.com", "xander.ford@example.com",
    "yuki.tanaka@example.com",
  ];

  let waitlistCount = 0;
  for (const email of waitlistEmails) {
    await prisma.waitlistSubscriber.upsert({
      where: { email },
      update: {},
      create: { email },
    });
    waitlistCount++;
  }
  console.log(`  Waitlist subscribers: ${waitlistCount}`);

  // ─────────────────────────────────────────────────────────────────────────
  // Notifications
  // ─────────────────────────────────────────────────────────────────────────

  const apexNotifications = [
    { type: "EVENT_APPROVED" as const, title: "Event approved", body: `"${apexEvent1.title}" has been approved and is now live on Startline.`, eventId: apexEvent1.id },
    { type: "EVENT_REJECTED" as const, title: "Event rejected", body: `"${apexEvent5.title}" has been rejected: ${apexEvent5.rejectionReason}`, eventId: apexEvent5.id },
    { type: "NEW_REGISTRATION" as const, title: "New registration", body: `${athleteNames[0]} registered for "${apexEvent1.title}" — Early Bird.`, eventId: apexEvent1.id, read: false },
    { type: "NEW_REGISTRATION" as const, title: "New registration", body: `${athleteNames[1]} registered for "${apexEvent1.title}" — General.`, eventId: apexEvent1.id, read: false },
    { type: "NEW_REGISTRATION" as const, title: "New registration", body: `${athleteNames[2]} registered for "${apexEvent1.title}" — Late Entry.`, eventId: apexEvent1.id, read: true },
    { type: "NEW_REGISTRATION" as const, title: "New registration", body: `${athleteNames[3]} registered for "${apexEvent1.title}" — Early Bird.`, eventId: apexEvent1.id, read: true },
    { type: "NEW_REGISTRATION" as const, title: "New registration", body: `Nina Vasquez cancelled their registration for "${apexEvent1.title}".`, eventId: apexEvent1.id, read: false },
    { type: "NEW_REGISTRATION" as const, title: "Registration refunded", body: `Dylan Cross was refunded for "${apexEvent1.title}".`, eventId: apexEvent1.id, read: true },
  ];

  const coastalNotifications = [
    { type: "EVENT_APPROVED" as const, title: "Event approved", body: `"${coastalEvent1.title}" has been approved and is now live on Startline.`, eventId: coastalEvent1.id },
    { type: "NEW_REGISTRATION" as const, title: "New registration", body: `${byronAthletes[0]} registered for "${coastalEvent1.title}" — Early Bird.`, eventId: coastalEvent1.id, read: false },
    { type: "NEW_REGISTRATION" as const, title: "New registration", body: `${byronAthletes[1]} registered for "${coastalEvent1.title}" — Standard.`, eventId: coastalEvent1.id, read: false },
    { type: "NEW_REGISTRATION" as const, title: "New registration", body: `${byronAthletes[2]} registered for "${coastalEvent1.title}" — Early Bird.`, eventId: coastalEvent1.id, read: true },
    { type: "NEW_REGISTRATION" as const, title: "New registration", body: `${byronAthletes[3]} registered for "${coastalEvent1.title}" — Standard.`, eventId: coastalEvent1.id, read: true },
    { type: "NEW_REGISTRATION" as const, title: "Registration cancelled", body: `${byronAthletes[6]} cancelled their registration for "${coastalEvent1.title}".`, eventId: coastalEvent1.id, read: false },
  ];

  const urbanNotifications = [
    { type: "EVENT_APPROVED" as const, title: "Event approved", body: `"${urbanEvent1.title}" has been approved and is now live on Startline.`, eventId: urbanEvent1.id },
    { type: "NEW_REGISTRATION" as const, title: "New registration", body: `${melbAthletes[0]} registered for "${urbanEvent1.title}" — Early Bird.`, eventId: urbanEvent1.id, read: false },
    { type: "NEW_REGISTRATION" as const, title: "New registration", body: `${melbAthletes[1]} registered for "${urbanEvent1.title}" — Standard.`, eventId: urbanEvent1.id, read: false },
    { type: "NEW_REGISTRATION" as const, title: "New registration", body: `${melbAthletes[2]} registered for "${urbanEvent1.title}" — Early Bird.`, eventId: urbanEvent1.id, read: true },
    { type: "NEW_REGISTRATION" as const, title: "New registration", body: `${melbAthletes[3]} registered for "${urbanEvent1.title}" — Standard.`, eventId: urbanEvent1.id, read: true },
  ];

  const generalApexNotifications = [
    { type: "EVENT_APPROVED" as const, title: "Event approved", body: `"${apexEvent2.title}" has been reviewed — still pending final approval.`, eventId: apexEvent2.id },
    { type: "EVENT_APPROVED" as const, title: "Event approved", body: `"${apexEvent3.title}" has been reviewed — still pending final approval.`, eventId: apexEvent3.id },
    { type: "NEW_REGISTRATION" as const, title: "New registration", body: `${athleteNames[4]} registered for "${apexEvent2.title}" — General Entry.`, eventId: apexEvent2.id, read: false },
    { type: "NEW_REGISTRATION" as const, title: "New registration", body: `${athleteNames[5]} registered for "${apexEvent3.title}" — Early Bird.`, eventId: apexEvent3.id, read: false },
  ];

  let notifCount = 0;
  const allNotifications = [
    ...apexNotifications.map(n => ({ ...n, organiserId: apexOrg.id })),
    ...coastalNotifications.map(n => ({ ...n, organiserId: coastalOrg.id })),
    ...urbanNotifications.map(n => ({ ...n, organiserId: urbanOrg.id })),
    ...generalApexNotifications.map(n => ({ ...n, organiserId: apexOrg.id })),
  ];

  for (let i = 0; i < allNotifications.length; i++) {
    const n = allNotifications[i];
    await prisma.notification.create({
      data: {
        organiserId: n.organiserId,
        type:        n.type,
        title:       n.title,
        body:        n.body,
        eventId:     n.eventId,
        read:        "read" in n ? n.read : true,
        createdAt:   new Date(Date.now() - (allNotifications.length - i) * 3600000),
      },
    });
    notifCount++;
  }
  console.log(`  Notifications: ${notifCount}`);

  // ─────────────────────────────────────────────────────────────────────────
  // Announcements
  // ─────────────────────────────────────────────────────────────────────────

  const apexAnnouncements = [
    { title: "Workout 1 released!", body: "Check your athlete portal — Workout 1 details are now live. 3 rounds for time: 400m run, 21 KB swings (24/16kg), 12 pull-ups." },
    { title: "Vendor expo lineup confirmed", body: "We're excited to announce our vendor partners: Primal Supplements, FITAID Australia, and WIT Fitness will all have pop-up stores at the event." },
    { title: "Parking update", body: "Additional parking has been secured at Albert Park College (5 min walk). Look for the Startline signage on Danks Street." },
    { title: "Heat assignments posted", body: "Heat assignments for Saturday are now available. Log in to your athlete dashboard to see your start times." },
    { title: "Volunteer callout", body: "We still need 8 more volunteers for Sunday. Free event merch + lunch included. Reply to this announcement if you can help!" },
    { title: "Live stream confirmed", body: "We're live streaming the Elite division finals on YouTube. Link will be shared 24 hours before the event. Tell your friends and family!" },
  ];

  const coastalAnnouncements = [
    { title: "Course preview video", body: "Drive through of the 21km course is now up on our Instagram. Check the highlights for key sections and aid station locations." },
    { title: "Bib pickup locations", body: "Early bib pickup available Friday 2-6pm at Byron Bay Surf Club. Race day pickup opens at 5:30am at the start line." },
    { title: "Weather update", body: "Forecast is looking great — 18°C and partly cloudy. Perfect running conditions. Remember to still bring a rain jacket just in case!" },
  ];

  const urbanAnnouncements = [
    { title: "Road closure notice", body: "Please note: St Kilda Road will be partially closed between 7am-11am. Plan your route to the venue accordingly." },
    { title: "Kids dash registration", body: "Free registration is now open for the Kids 1km Dash. Limited to 150 spots. Parents must accompany children under 6." },
    { title: "Post-run recovery zone", body: "New this year: a recovery zone with foam rollers, stretching mats, and free electrolyte refills courtesy of our partners." },
    { title: "Volunteer shout-out", body: "Huge thanks to our 45 volunteers who've signed up so far. We still need 10 more course marshals — free event entry for next year if you volunteer!" },
  ];

  const hybridAnnouncements = [
    { title: "Athlete guide now available", body: "The full athlete guide for Hybrid Hustle Round 3 has been published. Download it from the event page or your registration confirmation email." },
    { title: "Gear checklist", body: "Reminder: you'll need trail shoes, gloves for obstacle sections, and a hydration vest. No aid stations on the trail section (km 3-7)." },
  ];

  const crossfitAnnouncements = [
    { title: "Affiliate Cup format", body: "Affiliate Cup teams are M-M-F format. All athletes must have current CrossFit membership. Registration closes 2 weeks before the event." },
    { title: "Early bird extended", body: "Early bird pricing has been extended until August 1st due to popular demand. Lock in your spot at the lower rate!" },
  ];

  const teamThrowdownAnnouncements = [
    { title: "Venue shortlist", body: "We're currently evaluating two venues in Western Sydney. Decision expected within 2 weeks — watch this space." },
  ];

  const sydneyHarbourAnnouncements = [
    { title: "Course certification pending", body: "The 10km course is currently being measured and certified by Athletics Australia. We expect confirmation within 3 weeks." },
    { title: "Race day schedule", body: "Proposed schedule: 6:00am bib pickup, 6:45am warm-up, 7:00am race start. Waves will be released in 5-minute intervals by predicted pace." },
  ];

  const announcementGroups: { eventId: string; organiserId: string; items: { title: string; body: string }[] }[] = [
    { eventId: apexEvent1.id, organiserId: apexOrg.id, items: apexAnnouncements },
    { eventId: coastalEvent1.id, organiserId: coastalOrg.id, items: coastalAnnouncements },
    { eventId: urbanEvent1.id, organiserId: urbanOrg.id, items: urbanAnnouncements },
    { eventId: apexEvent2.id, organiserId: apexOrg.id, items: hybridAnnouncements },
    { eventId: apexEvent3.id, organiserId: apexOrg.id, items: crossfitAnnouncements },
    { eventId: apexEvent4.id, organiserId: apexOrg.id, items: teamThrowdownAnnouncements },
    { eventId: coastalEvent2.id, organiserId: coastalOrg.id, items: sydneyHarbourAnnouncements },
  ];

  let announcementCount = 0;
  for (const group of announcementGroups) {
    for (let i = 0; i < group.items.length; i++) {
      await prisma.announcement.create({
        data: {
          eventId:     group.eventId,
          organiserId: group.organiserId,
          title:       group.items[i].title,
          body:        group.items[i].body,
          createdAt:   new Date(Date.now() - (group.items.length - i) * 86400000),
        },
      });
      announcementCount++;
    }
  }
  console.log(`  Announcements: ${announcementCount}`);

  // ─────────────────────────────────────────────────────────────────────────
  // More reviews
  // ─────────────────────────────────────────────────────────────────────────

  const newReviews = [
    { organisers: apexOrg, event: apexEvent1, reviewerName: "Mia Fontaine", title: "Brilliant event, will be back", body: "Third year doing Apex Throwdown and this was the best one yet.", overallRating: 5, communicationRating: 5, organisationRating: 5, experienceRating: 5, isVerified: true },
    { organisers: apexOrg, event: apexEvent1, reviewerName: "Jack Donovan", title: "Great comp, tough workouts", body: "Workouts were brutal but fair. Only complaint: the warm-up area was a bit cramped.", overallRating: 4, communicationRating: 5, organisationRating: 4, experienceRating: 4, isVerified: true },
    { organisers: coastalOrg, event: coastalEvent1, reviewerName: "Rory McIntyre", title: "Best trail event on the east coast", body: "The Byron Bay course was breathtaking. Well marked, great aid stations.", overallRating: 5, communicationRating: 5, organisationRating: 5, experienceRating: 5, isVerified: true },
    { organisers: coastalOrg, event: coastalEvent1, reviewerName: "Tessa Nguyen", title: "Perfect morning on the trails", body: "Great organisation from start to finish. The volunteers were so encouraging.", overallRating: 5, communicationRating: 4, organisationRating: 5, experienceRating: 5, isVerified: true },
    { organisers: coastalOrg, event: coastalEvent1, reviewerName: "Haruki Sato", title: "Beautiful but challenging", body: "The half marathon course was tougher than expected with those hills.", overallRating: 4, communicationRating: 5, organisationRating: 4, experienceRating: 4, isVerified: true },
    { organisers: urbanOrg, event: urbanEvent1, reviewerName: "Angus McDonald", title: "Great family event", body: "Brought the whole family. Well organised, great atmosphere.", overallRating: 5, communicationRating: 5, organisationRating: 5, experienceRating: 5, isVerified: true },
    { organisers: urbanOrg, event: urbanEvent1, reviewerName: "Isabella Torres", title: "Loved the city course", body: "Running through the Royal Botanic Gardens at sunrise was magical.", overallRating: 5, communicationRating: 4, organisationRating: 5, experienceRating: 5, isVerified: true },
    { organisers: urbanOrg, event: urbanEvent1, reviewerName: "Raj Kapoor", title: "Solid event, minor suggestions", body: "Would love to see more drink stations on the 10k course.", overallRating: 4, communicationRating: 4, organisationRating: 4, experienceRating: 4, isVerified: true },
    { organisers: apexOrg, event: apexEvent2, reviewerName: "Liam O'Connor", title: "Hybrid Hustle keeps getting better", body: "Round 3 delivered. The trail section through the Dandenongs was epic.", overallRating: 5, communicationRating: 5, organisationRating: 4, experienceRating: 5, isVerified: true },
    { organisers: apexOrg, event: apexEvent2, reviewerName: "Noah Pereira", title: "Perfect blend of running and fitness", body: "As someone who does both CrossFit and trail running, this event was basically made for me.", overallRating: 4, communicationRating: 4, organisationRating: 4, experienceRating: 5, isVerified: true },
    { organisers: apexOrg, event: apexEvent2, reviewerName: "Chloe Bennett", title: "Challenging but rewarding", body: "Great community vibe throughout.", overallRating: 4, communicationRating: 5, organisationRating: 3, experienceRating: 4, isVerified: true },
    { organisers: apexOrg, event: apexEvent3, reviewerName: "Ethan Walsh", title: "Beach CrossFit at its best", body: "The Broadbeach location was incredible. Workouts were well programmed.", overallRating: 5, communicationRating: 5, organisationRating: 5, experienceRating: 5, isVerified: true },
    { organisers: apexOrg, event: apexEvent3, reviewerName: "Brooke Mitchell", title: "Great comp, amazing community", body: "First time at Coastline CrossFit Classic and it exceeded expectations.", overallRating: 5, communicationRating: 4, organisationRating: 5, experienceRating: 5, isVerified: true },
    { organisers: apexOrg, event: apexEvent3, reviewerName: "Daniel Cho", title: "Solid programming", body: "Workouts were well balanced across modalities.", overallRating: 4, communicationRating: 4, organisationRating: 4, experienceRating: 4, isVerified: true },
    { organisers: apexOrg, reviewerName: "Emma Whitfield", title: "Great organiser, consistently excellent events", body: "I've done three Apex events now and they never disappoint.", overallRating: 5, communicationRating: 5, organisationRating: 5, experienceRating: 5, isVerified: true },
    { organisers: coastalOrg, reviewerName: "Maya Patel", title: "Coastal Trail Running sets the standard", body: "Sarah's events are always impeccably organised.", overallRating: 5, communicationRating: 5, organisationRating: 5, experienceRating: 5, isVerified: true },
  ];

  let existingReviewCount = allInitialReviewIds.length;
  for (let i = 0; i < newReviews.length; i++) {
    const r = newReviews[i];
    await prisma.review.upsert({
      where:  { id: `seed-review-${String(existingReviewCount + i + 1).padStart(3, "0")}` },
      update: {},
      create: {
        id:              `seed-review-${String(existingReviewCount + i + 1).padStart(3, "0")}`,
        organiserId:     r.organisers.id,
        ...(r.event ? { eventId: r.event.id, eventTitle: r.event.title } : {}),
        reviewerName:    r.reviewerName,
        title:           r.title,
        body:            r.body,
        overallRating:       r.overallRating,
        communicationRating: r.communicationRating,
        organisationRating:  r.organisationRating,
        experienceRating:    r.experienceRating,
        isVerified:      r.isVerified,
      },
    });
    reviewCount++;
  }
  console.log(`  More reviews: ${newReviews.length} created`);
  console.log(`  Total reviews: ${reviewCount}`);

  console.log("\n✅ Database seeding complete!");
  console.log("   Users created/updated in Cognito with password:", PASSWORD);
}

main()
  .catch(e => {
    console.error("Seed failed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
