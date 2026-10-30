import { NextResponse } from "next/server";
import { sessionCookie } from "@/lib/session";

export async function POST(req: Request) {
  const res = NextResponse.redirect(new URL("/", req.url), 303);
  res.cookies.delete(sessionCookie.name);
  return res;
}
