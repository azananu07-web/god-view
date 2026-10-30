import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { exchangeCode } from "@/lib/ghl/oauth";
import { emptyStore, loadStore, saveStore } from "@/lib/store";
import { encodeSession, sessionCookie } from "@/lib/session";
import { startSync } from "@/lib/sync";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const fail = (msg: string) => NextResponse.redirect(new URL("/?error=" + encodeURIComponent(msg), req.url));
  const code = url.searchParams.get("code");
  if (!code) return fail(url.searchParams.get("error_description") ?? "Missing authorization code");

  // Installs started from the HighLevel marketplace arrive without our state; ones we started must match.
  const state = url.searchParams.get("state");
  const expected = cookies().get("gv_oauth_state")?.value;
  if (state && expected && state !== expected) return fail("OAuth state mismatch – please try again");

  try {
    const t = await exchangeCode(code);
    if (!t.companyId) return fail("Token has no companyId");
    if (t.userType && t.userType !== "Company") return fail("Install the app at the Agency level so it can read every sub-account.");

    const store = (await loadStore(t.companyId)) ?? emptyStore(t.companyId, "live");
    store.mode = "live";
    store.auth = {
      companyId: t.companyId,
      userId: t.userId,
      accessToken: t.access_token,
      refreshToken: t.refresh_token,
      expiresAt: Date.now() + t.expires_in * 1000,
      scope: t.scope,
    };
    store.locationTokens = {};
    await saveStore(store);
    void startSync(store);

    const res = NextResponse.redirect(new URL("/dashboard", req.url));
    res.cookies.set(sessionCookie.name, encodeSession(t.companyId), sessionCookie.options);
    res.cookies.delete("gv_oauth_state");
    return res;
  } catch (e: any) {
    return fail(e?.message ?? "OAuth exchange failed");
  }
}
