import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

const VALID = ["email", "whatsapp", "both"];

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const { shop, notifyChannels } = body || {};

  if (!shop || !VALID.includes(notifyChannels)) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  await db.shop.update({
    where: { shopDomain: shop },
    data: { notifyChannels },
  });

  return NextResponse.json({ success: true });
}
