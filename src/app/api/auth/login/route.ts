import crypto from "crypto";
import { NextResponse } from "next/server";
import { authorizeUrl, ghlConfigured } from "@/lib/ghl/oauth";

export async function GET(req: Request) {
  if (!ghlConfigured()) {
    return NextResponse.redirect(new URL("/?error=" + encodeURIComponent("GHL_CLIENT_ID / GHL_CLIENT_SECRET / GHL_REDIRECT_URI are not set"), req.url));
  }
  const state = crypto.randomBytes(16).toString("hex");
  const res = NextResponse.redirect(authorizeUrl(state));
  res.cookies.set("gv_oauth_state", state, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 600 });
  return res;
}
