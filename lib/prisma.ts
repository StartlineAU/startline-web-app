import { PrismaClient } from "@prisma/client";

// Create a singleton so that hot‑reloading in development doesn't create
// multiple clients. This pattern is recommended in the Prisma docs for Next.js.

declare global {
  // allow global `var` declarations
  // eslint-disable-next-line no-var
  var prisma: PrismaClient | undefined;
}

const client = global.prisma || new PrismaClient();
if (process.env.NODE_ENV !== "production") global.prisma = client;

export default client;
