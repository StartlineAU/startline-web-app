import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getServerSession } from "@/lib/amplify-server";

export async function POST() {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorised." }, { status: 401 });
  }

  try {
    const customer = await prisma.customer.findUnique({
      where: { cognitoSub: session.sub },
      select: { id: true },
    });
    if (!customer) {
      return NextResponse.json({ hasOrganiser: false, error: "No customer record found." }, { status: 404 });
    }

    const organiser = await prisma.organiser.findUnique({
      where:  { customerId: customer.id },
      select: { id: true },
    });

    return NextResponse.json({ hasOrganiser: !!organiser });
  } catch (err) {
    console.error("Organiser auth session error:", err);
    return NextResponse.json({ error: "Service unavailable." }, { status: 503 });
  }
}
