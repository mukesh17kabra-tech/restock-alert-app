import { NextRequest, NextResponse } from "next/server";
import { getInstallUrl } from "@/lib/shopify";
import crypto from "crypto";

export async function GET(req: NextRequest) {
  const shop = req.nextUrl.searchParams.get("shop");
  if (!shop) {
    return NextResponse.json({ error: "Missing shop parameter" }, { status: 400 });
  }

  const state = crypto.randomBytes(16).toString("hex");
  const installUrl = getInstallUrl(shop, state);

  const res = NextResponse.redirect(installUrl);
  // store state in a cookie so callback can verify it (basic CSRF protection)
  res.cookies.set("shopify_oauth_state", state, {
    httpOnly: true,
    secure: true,
    maxAge: 60 * 10,
  });
  return res;
}
