import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCustomerSession } from "@/lib/amplify-server";

export async function GET() {
  const session = await getCustomerSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorised." }, { status: 401 });
  }

  const customer = await prisma.customer.findUnique({
    where:  { id: session.sub },
    select: { id: true, email: true, name: true },
  });
  return NextResponse.json(customer);
}

export async function PUT(req: Request) {
  const session = await getCustomerSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorised." }, { status: 401 });
  }

  const { name } = await req.json();
  const customer = await prisma.customer.update({
    where:  { id: session.sub },
    data:   { name: name?.trim() || null },
    select: { id: true, email: true, name: true },
  });
  return NextResponse.json(customer);
}
