import { NextResponse } from "next/server";
import { encodeSession, sessionCookie } from "@/lib/session";

export async function GET(req: Request) {
  const res = NextResponse.redirect(new URL("/dashboard", req.url));
  res.cookies.set(sessionCookie.name, encodeSession("demo"), sessionCookie.options);
  return res;
}
