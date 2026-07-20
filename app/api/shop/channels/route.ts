import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

function withCors(res: NextResponse) {
  res.headers.set("Access-Control-Allow-Origin", "*");
  return res;
}

export async function GET(req: NextRequest) {
  const shop = req.nextUrl.searchParams.get("shop");
  if (!shop) {
    return withCors(NextResponse.json({ error: "Missing shop" }, { status: 400 }));
  }

  const shopRecord = await db.shop.findUnique({
    where: { shopDomain: shop },
    select: { notifyChannels: true },
  });

  if (!shopRecord) {
    return withCors(NextResponse.json({ notifyChannels: "email" }));
  }

  return withCors(NextResponse.json({ notifyChannels: shopRecord.notifyChannels }));
}
