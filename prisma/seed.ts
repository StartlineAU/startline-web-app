import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import crypto from "crypto";

const prisma = new PrismaClient();

const ADMINS = [
  { name: "Admin One",   email: "admin1@startlineau.com" },
  { name: "Admin Two",   email: "admin2@startlineau.com" },
  { name: "Admin Three", email: "admin3@startlineau.com" },
  { name: "Admin Four",  email: "admin4@startlineau.com" },
];

async function main() {
  console.log("Seeding admin accounts…\n");

  for (const admin of ADMINS) {
    const tempPassword = crypto.randomBytes(10).toString("hex");
    const hashed = await bcrypt.hash(tempPassword, 12);

    await prisma.admin.upsert({
      where:  { email: admin.email },
      update: {},
      create: { name: admin.name, email: admin.email, password: hashed },
    });

    console.log(`✓  ${admin.email}  →  temp password: ${tempPassword}`);
  }

  console.log("\nChange these passwords immediately after first login.");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
