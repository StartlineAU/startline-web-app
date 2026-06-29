import { PrismaClient } from "@prisma/client";
import {
  buildEventCreateData,
  flatToEventWritePayload,
  type FlatEventInput,
} from "../lib/event-data";
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

async function upsertSeedEvent(
  id: string,
  organiserId: string,
  status: import("@prisma/client").EventStatus,
  flat: FlatEventInput,
  extra?: { rejectionReason?: string; reviewedAt?: Date },
) {
  const hasReview = extra?.rejectionReason || extra?.reviewedAt;
  return prisma.event.upsert({
    where: { id },
    update: { status },
    create: {
      id,
      ...buildEventCreateData(organiserId, status, flatToEventWritePayload(flat)),
      ...(hasReview
        ? {
            adminReview: {
              create: {
                rejectionReason: extra?.rejectionReason,
                reviewedAt: extra?.reviewedAt,
              },
            },
          }
        : {}),
    },
  });
}

const PASSWORD = "Password123!";

const SKIP_COGNITO = process.env.SEED_SKIP_COGNITO === "true";

/** Stable subs for DB-only local seed when Cognito API is unavailable */
const LOCAL_SEED_SUBS: Record<string, string> = {
  "admin@startline.test":     "seed-local-00000000-0000-4000-8000-000000000001",
  "organiser@startline.test": "seed-local-00000000-0000-4000-8000-000000000002",
  "user@startline.test":      "seed-local-00000000-0000-4000-8000-000000000003",
};

function printAwsCredentialsHelp(): void {
  console.error(`
  AWS credentials not found — seed needs Cognito admin API access.

  Option A (recommended): configure AWS credentials, then re-run:
    - Add AWS_ACCESS_KEY_ID + AWS_SECRET_ACCESS_KEY to .env.local, or
    - Set AWS_PROFILE in .env.local to a profile with Cognito admin access

  Option B (DB-only, no login): add to .env.local and re-run:
    SEED_SKIP_COGNITO=true
`);
}

const region       = process.env.NEXT_PUBLIC_AWS_REGION ?? "ap-southeast-2";
const userPoolId   = process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID ?? "";
const userPoolName = userPoolId.split("_").pop() ?? "unknown";

const cognito = new CognitoIdentityProviderClient({ region });

type SeedUser = {
  email: string;
  isAdmin: boolean;
  displayName: string;
};

const SEED_USERS: SeedUser[] = [
  { email: "admin@startline.test",     isAdmin: true,  displayName: "Admin User" },
  { email: "organiser@startline.test",  isAdmin: false, displayName: "Test Organiser" },
  { email: "user@startline.test",   isAdmin: false, displayName: "Test User" },
];

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

    if (user.isAdmin) {
      await cognito.send(new AdminAddUserToGroupCommand({
        UserPoolId: userPoolId,
        Username: user.email,
        GroupName: "admins",
      }));
    }
  }
  console.log(`  Cognito: ${created} created, ${SEED_USERS.length - created} already existed`);
}

async function fetchCognitoSubs(): Promise<{
  subsByEmail: Record<string, string>;
  adminSubs: string[];
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

  const adminResp = await cognito.send(new ListUsersInGroupCommand({
    UserPoolId: userPoolId,
    GroupName: "admins",
  }));
  const adminSubs = (adminResp.Users ?? []).map(u => u.Username!);

  return { subsByEmail, adminSubs };
}

async function main() {
  console.log("🌱 Seeding database…\n");

  if (!SKIP_COGNITO && !userPoolId) {
    console.error("  NEXT_PUBLIC_COGNITO_USER_POOL_ID not set in environment");
    process.exit(1);
  }

  let subsByEmail: Record<string, string>;
  let adminSubs: string[];

  if (SKIP_COGNITO) {
    console.log("  SEED_SKIP_COGNITO=true — skipping Cognito (database-only seed; login will not work)\n");
    subsByEmail = LOCAL_SEED_SUBS;
    adminSubs = [LOCAL_SEED_SUBS["admin@startline.test"]];
  } else {
    try {
      await ensureCognitoUsers();
      ({ subsByEmail, adminSubs } = await fetchCognitoSubs());
    } catch (err) {
      const name = err instanceof Error ? err.name : "";
      if (name === "CredentialsProviderError" || String(err).includes("Could not load credentials")) {
        printAwsCredentialsHelp();
        process.exit(1);
      }
      throw err;
    }
    console.log(`  Cognito users found: ${Object.keys(subsByEmail).length}`);
  }

  await prisma.registration.deleteMany();
  await prisma.review.deleteMany();
  await prisma.announcement.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.event.deleteMany();
  await prisma.admin.deleteMany();
  await prisma.user.deleteMany();
  await prisma.waitlistSubscriber.deleteMany();
  await prisma.organiser.deleteMany();
  console.log("  Cleared existing data");

  // ── Admin ────────────────────────────────────────────────────────────
  const adminRecords: { id: string; email: string; name: string | null }[] = [];
  for (const user of SEED_USERS) {
    if (!user.isAdmin) continue;
    const sub = subsByEmail[user.email];
    if (!sub) continue;
    const record = await prisma.admin.create({
      data: { cognitoSub: sub, email: user.email, name: user.displayName },
    });
    adminRecords.push(record);
  }
  console.log(`  Admins: ${adminRecords.length}`);

  // ── Users ────────────────────────────────────────────────────────
  const userBySub: Record<string, string> = {};
  for (const user of SEED_USERS) {
    const sub = subsByEmail[user.email];
    if (!sub) {
      console.warn(`  WARN: Cognito user not found for ${user.email} — skipping`);
      continue;
    }
    const record = await prisma.user.upsert({
      where: { cognitoSub: sub },
      update: {},
      create: {
        cognitoSub: sub,
        email: user.email,
        name: user.displayName,
        username: user.email.split("@")[0].replace(/[^a-z0-9_]/gi, "_").toLowerCase(),
      },
    });
    userBySub[sub] = record.id;
  }
  console.log(`  Users: ${SEED_USERS.length}`);

  // ── Organiser ────────────────────────────────────────────────────────
  const orgSub = subsByEmail["organiser@startline.test"];
  let orgRecord: { id: string; email: string; orgName: string | null; instagram: string | null; facebook: string | null } | null = null;

  if (orgSub) {
    const userId = userBySub[orgSub];
    if (userId) {
      orgRecord = await prisma.organiser.create({
        data: {
          userId,
          email: "organiser@startline.test",
          verified: true,
          status: "APPROVED",
          orgName: "Apex Endurance Events",
          contactName: "Test Organiser",
          contactEmail: "organiser@startline.test",
          phone: "+61 400 000 000",
          abn: "51 824 753 556",
          website: "https://startlineau.com",
          instagram: "apexenduranceevents",
          bio: "Test organiser for development and testing purposes.",
          photos: [],
        },
      });
    }
  }

  if (!orgRecord) {
    console.error("  Failed to create organiser record.");
    process.exit(1);
  }
  console.log("  Organiser: 1 (Apex Endurance Events)");

  const org = orgRecord;

  const platformFeeCents = (amountCents: number) =>
    Math.round(amountCents * 0.0395) + 145;

  // ── Events ───────────────────────────────────────────────────────────

  const event1 = await upsertSeedEvent("seed-event-001", org.id, "APPROVED", {
    title: "The Apex Throwdown 2026",
    discipline: "functional_fitness",
    tagline: "Two days. One leaderboard. Every rep counts.",
    description: "Victoria's premier functional fitness competition. Three workouts across two days. Scaled, RX, and Elite divisions.",
    eventDate: "2026-08-15", endDate: "2026-08-16", startTime: "07:30", endTime: "17:00",
    venue: "Melbourne Sports & Aquatic Centre", address: "Albert Road, Albert Park",
    city: "Melbourne", state: "vic", format: "both", level: "open",
    categories: ["Individual Scaled", "Individual RX", "Individual Elite", "Team of 2"],
    cap: 320, minAge: 16,
    waves: [{ label: "Early Bird", date: "2026-05-01", price: "95", qty: 80 }, { label: "General", date: "2026-06-15", price: "115", qty: 150 }, { label: "Late Entry", date: "2026-07-31", price: "135", qty: 90 }],
    inclusions: "Event t-shirt, finisher medal, post-event party, online score tracking",
    extras: "Spectator tickets $15/day. Parking $12/day.", activations: "Vendor expo Friday evening.",
    refundPolicy: "Moderate", registrationType: "startline", feeStructure: "athlete",
    coverImageUrl: "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=1200&q=80",
    bagDrop: "Bag drop at Gate 3 from 6:45am.", parking: "MSAC car park $12/day.", accessibilityInfo: "Wheelchair accessible venue.",
  });

  const event2 = await upsertSeedEvent("seed-event-002", org.id, "PENDING", {
    title: "Hybrid Hustle Series — Round 3", discipline: "hybrid",
    tagline: "Run. Lift. Repeat.",
    description: "Trail running, loaded carries, obstacle crawls, and a surprise finale.",
    eventDate: "2026-09-06", startTime: "08:00", endTime: "14:00",
    venue: "Kokoda Track Memorial Walkway", city: "Scoresby", state: "vic",
    format: "individual", level: "open", categories: ["Open Male", "Open Female", "Masters 40+"],
    cap: 150, minAge: 16, waves: [{ label: "General Entry", date: "2026-07-01", price: "75", qty: 150 }],
    inclusions: "Race entry, finisher medal, recovery snack bag", refundPolicy: "Flexible",
    registrationType: "startline", feeStructure: "athlete",
    coverImageUrl: "https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?w=1200&q=80",
  });

  await upsertSeedEvent("seed-event-003", org.id, "DRAFT", {
    title: "Team Throwdown Summer Series", discipline: "functional_fitness",
    tagline: "", description: "Draft — details TBC",
    eventDate: "2026-12-05", startTime: "09:00", endTime: "15:00",
    venue: "TBC", city: "Sydney", state: "nsw", format: "team", level: "open",
    categories: [], waves: [], registrationType: "startline", feeStructure: "athlete",
  });

  await upsertSeedEvent("seed-event-004", org.id, "REJECTED", {
    title: "Autumn Run Festival", discipline: "running",
    tagline: "5K, 10K through the Yarra Valley",
    description: "A scenic trail run through the Yarra Valley vineyards.",
    eventDate: "2026-04-11", startTime: "07:30", endTime: "13:00",
    venue: "Yering Station", city: "Yering", state: "vic",
    format: "individual", level: "open", categories: ["5K", "10K", "Half Marathon"],
    cap: 500, waves: [{ label: "5K Entry", price: "45" }, { label: "10K Entry", price: "55" }, { label: "Half Marathon", price: "75" }],
    registrationType: "startline", feeStructure: "athlete", refundPolicy: "Firm",
  }, { rejectionReason: "Event date has already passed.", reviewedAt: new Date("2026-04-01T09:00:00Z") });

  const seedEvents = [
    { id: "seed-event-005", status: "APPROVED" as const, title: "Sydney Harbour 10K",         discipline: "running",   eventDate: "2026-09-20", startTime: "07:00", endTime: "10:00", venue: "Mrs Macquaries Chair",           city: "Sydney",   state: "nsw", format: "individual", level: "open",  categories: ["5K", "10K"],              cap: 2000, waves: [{ label: "General", price: "55" }], tagline: "Run past the Opera House", description: "A scenic 10K through Sydney's foreshore parks and past iconic landmarks." },
    { id: "seed-event-006", status: "APPROVED" as const, title: "Gold Coast Marathon Weekend", discipline: "running",   eventDate: "2026-07-05", startTime: "06:00", endTime: "14:00", venue: "Gold Coast Highway",             city: "Gold Coast", state: "qld", format: "individual", level: "open",  categories: ["Marathon", "Half Marathon", "10K", "5K"], cap: 5000, waves: [{ label: "Marathon Entry", price: "120" }, { label: "Half Marathon", price: "85" }, { label: "10K Entry", price: "50" }], tagline: "Flat, fast, coastal", description: "Australia's premier marathon along the Gold Coast beachfront." },
    { id: "seed-event-007", status: "APPROVED" as const, title: "Uluru Sunset Run",            discipline: "running",   eventDate: "2026-10-12", startTime: "16:00", endTime: "19:00", venue: "Uluru-Kata Tjuta National Park",  city: "Uluru",   state: "nt",  format: "individual", level: "open",  categories: ["5K Fun Run", "10K Trail"], cap: 500, waves: [{ label: "General", price: "65" }], tagline: "Run at sunset", description: "A once-in-a-lifetime trail run around the base of Uluru at sunset." },
    { id: "seed-event-008", status: "APPROVED" as const, title: "Melbourne Marathon Festival",  discipline: "running",   eventDate: "2026-10-12", startTime: "07:00", endTime: "15:00", venue: "MCG",                             city: "Melbourne", state: "vic", format: "individual", level: "open",  categories: ["Marathon", "Half Marathon", "10K", "5K"], cap: 8000, waves: [{ label: "Marathon", price: "110" }, { label: "Half", price: "75" }], tagline: "Finish on the 'G", description: "Iconic marathon finishing inside the Melbourne Cricket Ground." },
    { id: "seed-event-009", status: "APPROVED" as const, title: "London Thames Riverside Run",  discipline: "running",   eventDate: "2026-11-02", startTime: "09:00", endTime: "12:00", venue: "Tower Bridge Start",              city: "London", state: "nsw", format: "individual", level: "open",  categories: ["10K", "Half Marathon"],   cap: 3000, waves: [{ label: "General", price: "45" }], tagline: "Run the Thames path", description: "A scenic run along the River Thames through central London." },
    { id: "seed-event-010", status: "APPROVED" as const, title: "Around the Bay 2026",          discipline: "cycling",   eventDate: "2026-10-11", startTime: "06:30", endTime: "15:00", venue: "Albert Park Circuit",             city: "Melbourne", state: "vic", format: "individual", level: "open",  categories: ["210K", "100K", "50K", "35K"], cap: 10000, waves: [{ label: "210K Entry", price: "110" }, { label: "100K Entry", price: "75" }], tagline: "Ride around Port Phillip Bay", description: "Australia's biggest bike ride." },
    { id: "seed-event-011", status: "APPROVED" as const, title: "Tour de Brisbane Gran Fondo",  discipline: "cycling",   eventDate: "2026-08-30", startTime: "06:00", endTime: "14:00", venue: "Brisbane City Hall",              city: "Brisbane", state: "qld", format: "individual", level: "open",  categories: ["160K Gran Fondo", "100K Medio", "50K Corto"], cap: 3000, waves: [{ label: "Gran Fondo", price: "95" }, { label: "Medio", price: "75" }], tagline: "Climb the Cootha", description: "Gran fondo through Brisbane's scenic hinterland." },
    { id: "seed-event-012", status: "APPROVED" as const, title: "Perth Twilight Criterium",    discipline: "cycling",   eventDate: "2026-12-12", startTime: "17:00", endTime: "21:00", venue: "Perth CBD Circuit",               city: "Perth",   state: "wa",  format: "individual", level: "open",  categories: ["Elite Men", "Elite Women", "B Grade", "C Grade"], cap: 200, waves: [{ label: "Elite Entry", price: "35" }, { label: "Grade Entry", price: "25" }], tagline: "Night racing in the city", description: "Fast twilight criterium racing through the streets of Perth CBD." },
    { id: "seed-event-013", status: "APPROVED" as const, title: "Seven Hills of Hobart Ride",  discipline: "cycling",   eventDate: "2026-11-22", startTime: "07:00", endTime: "13:00", venue: "Hobart Waterfront",               city: "Hobart", state: "tas", format: "individual", level: "open",  categories: ["Full Course", "Short Course"], cap: 500, waves: [{ label: "Full", price: "60" }], tagline: "Conquer the hills", description: "A challenging ride tackling Hobart's seven iconic hills." },
    { id: "seed-event-014", status: "APPROVED" as const, title: "Bondi to Bronte Ocean Swim",   discipline: "swimming",  eventDate: "2026-12-20", startTime: "08:00", endTime: "11:00", venue: "Bondi Beach",                    city: "Sydney",   state: "nsw", format: "individual", level: "open",  categories: ["2.4K Swim", "1.2K Swim", "600m"], cap: 1500, waves: [{ label: "2.4K", price: "45" }, { label: "1.2K", price: "35" }], tagline: "Swim the iconic coastline", description: "Australia's most famous ocean swim from Bondi to Bronte." },
    { id: "seed-event-015", status: "APPROVED" as const, title: "Rottnest Channel Swim",       discipline: "swimming",  eventDate: "2026-02-21", startTime: "05:45", endTime: "14:00", venue: "Cottesloe Beach to Rottnest",     city: "Perth",   state: "wa",  format: "both", level: "open",  categories: ["Solo", "Duo", "Team of 4"], cap: 2500, waves: [{ label: "Solo Entry", price: "180" }, { label: "Team Entry (per person)", price: "80" }], tagline: "Swim the channel to Rotto", description: "The legendary 19.7K open water swim to Rottnest Island." },
    { id: "seed-event-016", status: "APPROVED" as const, title: "Kiama Harbour Swim",           discipline: "swimming",  eventDate: "2026-11-15", startTime: "09:00", endTime: "11:00", venue: "Kiama Harbour",                  city: "Kiama",   state: "nsw", format: "individual", level: "open",  categories: ["1K", "2K", "400m Junior"], cap: 400, waves: [{ label: "1K", price: "30" }, { label: "2K", price: "40" }], tagline: "Swim in the blowhole region", description: "A protected harbour swim in the beautiful Kiama region." },
    { id: "seed-event-017", status: "APPROVED" as const, title: "Noosa Triathlon 2026",         discipline: "triathlon", eventDate: "2026-10-31", startTime: "06:00", endTime: "16:00", venue: "Noosa Main Beach",               city: "Noosa",   state: "qld", format: "individual", level: "open",  categories: ["Olympic", "Sprint", "Enticer"], cap: 8000, waves: [{ label: "Olympic", price: "180" }, { label: "Sprint", price: "120" }], tagline: "Race the original", description: "Australia's largest triathlon in the stunning Sunshine Coast setting." },
    { id: "seed-event-018", status: "APPROVED" as const, title: "Ironman Western Australia",    discipline: "triathlon", eventDate: "2026-12-06", startTime: "05:30", endTime: "23:59", venue: "Busselton Jetty",                city: "Busselton", state: "wa",  format: "individual", level: "open",  categories: ["Ironman", "70.3"], cap: 3000, waves: [{ label: "Full Ironman", price: "750" }, { label: "70.3", price: "350" }], tagline: "Swim under the jetty", description: "Full distance ironman starting at the iconic Busselton Jetty." },
    { id: "seed-event-019", status: "APPROVED" as const, title: "Sydney Triathlon Series R3",   discipline: "triathlon", eventDate: "2026-11-08", startTime: "06:30", endTime: "12:00", venue: "Sydney Olympic Park",             city: "Sydney",   state: "nsw", format: "individual", level: "open",  categories: ["Olympic", "Sprint"], cap: 1500, waves: [{ label: "Olympic", price: "130" }, { label: "Sprint", price: "85" }], tagline: "Olympic course", description: "Triathlon racing on the Sydney 2000 Olympic course." },
    { id: "seed-event-020", status: "APPROVED" as const, title: "Run Bike Run Canberra",        discipline: "duathlon",  eventDate: "2026-09-06", startTime: "07:00", endTime: "11:00", venue: "Lake Burley Griffin",            city: "Canberra", state: "act", format: "individual", level: "open",  categories: ["Standard", "Sprint"], cap: 600, waves: [{ label: "Standard", price: "85" }, { label: "Sprint", price: "55" }], tagline: "Run. Bike. Run.", description: "Duathlon around scenic Lake Burley Griffin." },
    { id: "seed-event-021", status: "APPROVED" as const, title: "Dualthon Series — GC Round",   discipline: "duathlon",  eventDate: "2026-10-18", startTime: "06:00", endTime: "10:00", venue: "Broadwater Parklands",            city: "Gold Coast", state: "qld", format: "individual", level: "open",  categories: ["Standard", "Sprint", "Junior"], cap: 400, waves: [{ label: "Standard", price: "75" }, { label: "Sprint", price: "50" }], tagline: "Run bike run on the coast", description: "Duathlon on the beautiful Gold Coast Broadwater foreshore." },
    { id: "seed-event-022", status: "APPROVED" as const, title: "CrossFit Games Open 2026",     discipline: "crossfit",  eventDate: "2026-03-01", startTime: "08:00", endTime: "20:00", venue: "Allied HQ",                      city: "Sydney",   state: "nsw", format: "individual", level: "open",  categories: ["Rx", "Scaled"], cap: 200, waves: [{ label: "Rx", price: "20" }], tagline: "Test your fitness", description: "The CrossFit Open at Allied HQ." },
    { id: "seed-event-023", status: "APPROVED" as const, title: "F45 Championship World Final",  discipline: "crossfit",  eventDate: "2026-11-14", startTime: "09:00", endTime: "18:00", venue: "Qudos Bank Arena",               city: "Sydney",   state: "nsw", format: "individual", level: "open",  categories: ["Men's Pro", "Women's Pro", "Team"], cap: 1000, waves: [{ label: "Pro Entry", price: "150" }, { label: "Team Entry", price: "300" }], tagline: "World finals in Sydney", description: "The F45 Championship World Finals at Qudos Bank Arena." },
    { id: "seed-event-024", status: "APPROVED" as const, title: "Torian Pro 2026",              discipline: "crossfit",  eventDate: "2026-05-30", startTime: "07:00", endTime: "17:00", venue: "Brisbane Convention Centre",      city: "Brisbane", state: "qld", format: "both", level: "open",  categories: ["Elite Men", "Elite Women", "Teams"], cap: 400, waves: [{ label: "Spectator Weekend", price: "95" }, { label: "Team Entry", price: "250" }], tagline: "Pacific's fittest", description: "One of the biggest CrossFit competitions in the Southern Hemisphere." },
    { id: "seed-event-025", status: "APPROVED" as const, title: "True Grit 10K OCR",            discipline: "hybrid",    eventDate: "2026-08-22", startTime: "07:00", endTime: "15:00", venue: "Laratinga Wetlands",              city: "Mount Barker", state: "sa",  format: "individual", level: "open",  categories: ["Elite", "Open", "Junior"], cap: 1500, waves: [{ label: "Elite", price: "85" }, { label: "Open", price: "65" }], tagline: "Mud. Sweat. Grit.", description: "South Australia's premier obstacle course race." },
    { id: "seed-event-026", status: "APPROVED" as const, title: "Spartan Trifecta Weekend",      discipline: "hybrid",    eventDate: "2026-11-28", startTime: "06:00", endTime: "17:00", venue: "Sunningdale Trails",              city: "Canberra", state: "act", format: "individual", level: "open",  categories: ["Sprint", "Super", "Beast", "Ultra"], cap: 3000, waves: [{ label: "Sprint", price: "110" }, { label: "Beast", price: "180" }, { label: "Trifecta Pass", price: "320" }], tagline: "Complete the trifecta", description: "A full Spartan weekend across the Canberra trails." },
    { id: "seed-event-027", status: "APPROVED" as const, title: "Tough Mudder Sydney",          discipline: "hybrid",    eventDate: "2026-07-18", startTime: "08:00", endTime: "16:00", venue: "Penrith Whitewater Stadium",      city: "Sydney",   state: "nsw", format: "both", level: "open",  categories: ["Classic", "Team"], cap: 4000, waves: [{ label: "Classic", price: "130" }, { label: "Team (4+)", price: "110" }], tagline: "Teamwork makes the dream work", description: "The iconic mud run with 25+ obstacles at Penrith Whitewater." },
    { id: "seed-event-028", status: "APPROVED" as const, title: "AWF National Championships",    discipline: "weightlifting", eventDate: "2026-09-26", startTime: "09:00", endTime: "18:00", venue: "Adelaide Entertainment Centre", city: "Adelaide", state: "sa",  format: "individual", level: "open",  categories: ["Men's 61kg", "73kg", "89kg", "102kg", "Women's 49kg", "59kg", "71kg", "87kg"], cap: 300, waves: [{ label: "Competitor Entry", price: "80" }, { label: "Spectator", price: "30" }], tagline: "Australia's strongest", description: "AWF National Championships for 2026." },
    { id: "seed-event-029", status: "APPROVED" as const, title: "Sydney Open Powerlifting Cup",  discipline: "weightlifting", eventDate: "2026-08-08", startTime: "08:00", endTime: "17:00", venue: "Sydney Uni Sports Hall",          city: "Sydney",   state: "nsw", format: "individual", level: "open",  categories: ["Raw", "Equipped"], cap: 150, waves: [{ label: "Raw Entry", price: "65" }, { label: "Equipped", price: "75" }], tagline: "Lift heavy", description: "An all-ages powerlifting competition at Sydney University." },
    { id: "seed-event-030", status: "APPROVED" as const, title: "INBA Natural Titles",           discipline: "bodybuilding", eventDate: "2026-11-07", startTime: "10:00", endTime: "18:00", venue: "Melbourne Convention Centre",    city: "Melbourne", state: "vic", format: "individual", level: "open",  categories: ["Men's Physique", "Women's Figure", "Classic Physique", "Bikini"], cap: 500, waves: [{ label: "Competitor", price: "120" }, { label: "Spectator", price: "45" }], tagline: "Natural bodybuilding", description: "INBA natural bodybuilding championships in Melbourne." },
    { id: "seed-event-031", status: "APPROVED" as const, title: "Arnold Classic Australia",      discipline: "bodybuilding", eventDate: "2026-03-13", startTime: "09:00", endTime: "20:00", venue: "Melbourne Convention Centre",    city: "Melbourne", state: "vic", format: "individual", level: "open",  categories: ["Pro Men's", "Pro Women's", "Amateur"], cap: 800, waves: [{ label: "Pro Entry", price: "200" }, { label: "Spectator", price: "50" }], tagline: "The Arnold returns", description: "Arnold Sports Festival Australia featuring bodybuilding, expo, and strongman." },
    { id: "seed-event-032", status: "APPROVED" as const, title: "Chicago Marathon",              discipline: "running",   eventDate: "2026-10-11", startTime: "07:30", endTime: "14:00", venue: "Grant Park",                     city: "Chicago", state: "nsw", format: "individual", level: "open",  categories: ["Marathon"], cap: 45000, waves: [{ label: "General Entry", price: "220" }], tagline: "Run the Windy City", description: "One of the World Marathon Majors through the streets of Chicago." },
    { id: "seed-event-033", status: "APPROVED" as const, title: "Étape du Tour 2026",            discipline: "cycling",   eventDate: "2026-07-12", startTime: "06:00", endTime: "16:00", venue: "Bourg d'Oisans",                city: "Bourg d'Oisans", state: "nsw", format: "individual", level: "open",  categories: ["Full Stage"], cap: 15000, waves: [{ label: "Entry", price: "80" }], tagline: "Ride a Tour stage", description: "Ride the same stage as the pros on the Tour de France route." },
    { id: "seed-event-034", status: "APPROVED" as const, title: "NYC Triathlon",                discipline: "triathlon", eventDate: "2026-07-19", startTime: "06:00", endTime: "14:00", venue: "Hudson River",                   city: "New York", state: "nsw", format: "individual", level: "open",  categories: ["Olympic", "Sprint"], cap: 4000, waves: [{ label: "Olympic", price: "350" }, { label: "Sprint", price: "200" }], tagline: "Swim in the Hudson", description: "Triathlon through New York City — swim in the Hudson, bike through Manhattan." },
    { id: "seed-event-035", status: "APPROVED" as const, title: "London Marathon",               discipline: "running",   eventDate: "2026-04-26", startTime: "09:00", endTime: "16:00", venue: "Greenwich Park to The Mall",      city: "London", state: "nsw", format: "individual", level: "open",  categories: ["Marathon"], cap: 50000, waves: [{ label: "Championship Entry", price: "250" }], tagline: "Run past Big Ben", description: "The iconic London Marathon from Greenwich to The Mall." },
  ];

  for (const e of seedEvents) {
    await upsertSeedEvent(e.id, org.id, e.status, {
      title: e.title,
      discipline: e.discipline,
      tagline: e.tagline,
      description: e.description,
      eventDate: e.eventDate,
      startTime: e.startTime,
      endTime: e.endTime,
      venue: e.venue,
      city: e.city,
      state: e.state,
      format: e.format,
      level: e.level,
      categories: e.categories,
      cap: e.cap,
      waves: e.waves,
      registrationType: "startline",
      feeStructure: "athlete",
    });
  }

  console.log(`  Events: ${4 + seedEvents.length} (including 1 pending, 1 draft, 1 rejected)`);

  // ── Reviews ──────────────────────────────────────────────────────────

  await prisma.review.upsert({
    where:  { id: "seed-review-001" },
    update: {},
    create: {
      id: "seed-review-001",
      organiserId: org.id,
      eventId: event1.id,
      eventTitle: "The Apex Throwdown 2026",
      reviewerName: "Sarah K.",
      title: "Best competition I've done all year",
      body: "Incredibly well run from start to finish.",
      overallRating: 5, communicationRating: 5, organisationRating: 5, experienceRating: 5,
      isVerified: true,
    },
  });

  await prisma.review.upsert({
    where:  { id: "seed-review-002" },
    update: {},
    create: {
      id: "seed-review-002",
      organiserId: org.id,
      eventId: event1.id,
      eventTitle: "The Apex Throwdown 2026",
      reviewerName: "Tom R.",
      title: "Great event, minor timing hiccups",
      body: "Really enjoyed the event overall.",
      overallRating: 4, communicationRating: 5, organisationRating: 4, experienceRating: 4,
      isVerified: true,
    },
  });

  const extraReviews = [
    { id: "seed-review-003", reviewerName: "Mia Fontaine",   title: "Brilliant event, will be back", body: "Third year and this was the best one yet.", overallRating: 5, communicationRating: 5, organisationRating: 5, experienceRating: 5, event: event1, eventTitle: "The Apex Throwdown 2026" },
    { id: "seed-review-004", reviewerName: "Jack Donovan",   title: "Great comp, tough workouts", body: "Workouts were brutal but fair.", overallRating: 4, communicationRating: 5, organisationRating: 4, experienceRating: 4, event: event1, eventTitle: "The Apex Throwdown 2026" },
    { id: "seed-review-005", reviewerName: "Emma Whitfield", title: "Great organiser", body: "Consistently excellent events.", overallRating: 5, communicationRating: 5, organisationRating: 5, experienceRating: 5, event: null, eventTitle: null },
    { id: "seed-review-006", reviewerName: "Liam O'Connor",  title: "Hybrid Hustle keeps getting better", body: "The trail section through the Dandenongs was epic.", overallRating: 5, communicationRating: 5, organisationRating: 4, experienceRating: 5, event: event2, eventTitle: "Hybrid Hustle Series — Round 3" },
    { id: "seed-review-007", reviewerName: "Chloe Bennett",  title: "Challenging but rewarding", body: "Great community vibe.", overallRating: 4, communicationRating: 5, organisationRating: 3, experienceRating: 4, event: event2, eventTitle: "Hybrid Hustle Series — Round 3" },
  ];

  for (const r of extraReviews) {
    await prisma.review.upsert({
      where:  { id: r.id },
      update: {},
      create: {
        id: r.id,
        organiserId: org.id,
        ...(r.event ? { eventId: r.event.id, eventTitle: r.eventTitle ?? undefined } : {}),
        reviewerName: r.reviewerName,
        title: r.title, body: r.body,
        overallRating: r.overallRating,
        communicationRating: r.communicationRating,
        organisationRating: r.organisationRating,
        experienceRating: r.experienceRating,
        isVerified: true,
      },
    });
  }
  console.log(`  Reviews: ${2 + extraReviews.length}`);

  // ── Registrations ────────────────────────────────────────────────────

  const athleteNames = [
    "Alex Turner", "Bree Collins", "Cameron Nguyen", "Dana Wilson",
    "Eli Patel", "Fatima Hassan", "George Kim", "Hannah Jones",
    "Ivy Martin", "Jack Thompson", "Kara Adams", "Leo Robinson",
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
        id: `seed-reg-${String(i + 1).padStart(3, "0")}`,
        eventId: event1.id,
        organiserId: org.id,
        athleteName: name,
        athleteEmail: email,
        waveLabel: wave.label,
        amountCents,
        platformFeeCents: platformFeeCents(amountCents),
        feeStructure: "athlete",
        status: "CONFIRMED",
      },
    });
    regCount++;
  }

  const extraRegs = [
    { name: "Nina Vasquez", email: "nina@example.com", wave: "Early Bird", price: 95, status: "CANCELLED" as const },
    { name: "Dylan Cross", email: "dylan@example.com", wave: "General", price: 115, status: "REFUNDED" as const },
    { name: "Aisha Kazemi", email: "aisha@example.com", wave: "Late Entry", price: 135, status: "CONFIRMED" as const },
    { name: "Oscar De Luca", email: "oscar@example.com", wave: "Early Bird", price: 95, status: "CONFIRMED" as const },
  ];

  for (let i = 0; i < extraRegs.length; i++) {
    const r = extraRegs[i];
    const amountCents = r.price * 100;
    await prisma.registration.create({
      data: {
        eventId: event1.id,
        organiserId: org.id,
        athleteName: r.name,
        athleteEmail: r.email,
        waveLabel: r.wave,
        amountCents,
        platformFeeCents: platformFeeCents(amountCents),
        feeStructure: "athlete",
        status: r.status,
        stripePaymentIntentId: `pi_extra_${i}`,
      },
    });
    regCount++;
  }
  console.log(`  Registrations: ${regCount}`);

  // ── Notifications ────────────────────────────────────────────────────

  const notifications = [
    { type: "EVENT_APPROVED" as const, title: "Event approved", body: `"The Apex Throwdown 2026" is live on Startline.`, eventId: event1.id, read: true },
    { type: "EVENT_REJECTED" as const, title: "Event rejected", body: `"Autumn Run Festival" was rejected.`, eventId: "seed-event-004", read: true },
    { type: "NEW_REGISTRATION" as const, title: "New registration", body: `${athleteNames[0]} registered.`, eventId: event1.id, read: false },
    { type: "NEW_REGISTRATION" as const, title: "New registration", body: `${athleteNames[1]} registered.`, eventId: event1.id, read: false },
  ];

  for (let i = 0; i < notifications.length; i++) {
    const n = notifications[i];
    await prisma.notification.create({
      data: {
        organiserId: org.id,
        type: n.type, title: n.title, body: n.body,
        eventId: n.eventId,
        read: n.read,
        createdAt: new Date(Date.now() - (notifications.length - i) * 3600000),
      },
    });
  }
  console.log(`  Notifications: ${notifications.length}`);

  // ── Announcements ────────────────────────────────────────────────────

  const announcements = [
    { eventId: event1.id, title: "Workout 1 released!", body: "Check your athlete portal for details." },
    { eventId: event1.id, title: "Vendor expo lineup confirmed", body: "Primal Supplements, FITAID Australia, and WIT Fitness will be there." },
    { eventId: event1.id, title: "Heat assignments posted", body: "Log in to see your start times." },
    { eventId: event2.id, title: "Athlete guide available", body: "Download from the event page." },
    { eventId: event2.id, title: "Gear checklist", body: "You'll need trail shoes and a hydration vest." },
  ];

  for (let i = 0; i < announcements.length; i++) {
    const a = announcements[i];
    await prisma.announcement.create({
      data: {
        eventId: a.eventId,
        organiserId: org.id,
        title: a.title,
        body: a.body,
        createdAt: new Date(Date.now() - (announcements.length - i) * 86400000),
      },
    });
  }
  console.log(`  Announcements: ${announcements.length}`);

  // ── Waitlist ─────────────────────────────────────────────────────────

  const waitlistEmails = [
    "alex.turner@example.com", "bree.collins@example.com", "cameron.nguyen@example.com",
    "dana.wilson@example.com", "fatima.hassan@example.com", "george.kim@example.com",
  ];

  for (const email of waitlistEmails) {
    await prisma.waitlistSubscriber.upsert({
      where: { email },
      update: {},
      create: { email },
    });
  }
  console.log(`  Waitlist subscribers: ${waitlistEmails.length}`);

  console.log("\n✅ Database seeding complete!");
  if (SKIP_COGNITO) {
    console.log("   Mode: DB-only (SEED_SKIP_COGNITO=true — Cognito login disabled for seed users)");
  } else {
    console.log(`   Password for all users: ${PASSWORD}`);
    console.log("   Users: admin@startline.test, organiser@startline.test, user@startline.test");
  }
}

main()
  .catch(e => {
    console.error("Seed failed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
