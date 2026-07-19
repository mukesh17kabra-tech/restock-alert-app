import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { autoInstallWidget } from "@/lib/theme-install";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const shop = body?.shop as string | undefined;

  if (!shop) {
    return NextResponse.json({ success: false, error: "Missing shop" }, { status: 400 });
  }

  const shopRecord = await db.shop.findUnique({ where: { shopDomain: shop } });
  if (!shopRecord) {
    return NextResponse.json({ success: false, error: "Shop not found" }, { status: 404 });
  }

  const result = await autoInstallWidget(shop, shopRecord.accessToken);

  if (!result.success) {
    console.error(`[install-widget] Failed for ${shop}:`, result.error);
  }

  return NextResponse.json(result, { status: result.success ? 200 : 500 });
}
