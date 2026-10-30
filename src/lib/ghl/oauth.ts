import { ghlFetch } from "./client";

export const GHL_SCOPES = [
  "locations.readonly",
  "locations.write", // push snapshots to sub-accounts
  "locations/customValues.readonly", // ad spend
  "oauth.readonly",
  "oauth.write", // mint location tokens
  "companies.readonly",
  "contacts.readonly",
  "opportunities.readonly",
  "calendars.readonly",
  "calendars/events.readonly",
  "snapshots.readonly",
];

export function ghlConfigured() {
  return Boolean(process.env.GHL_CLIENT_ID && process.env.GHL_CLIENT_SECRET && process.env.GHL_REDIRECT_URI);
}

export function authorizeUrl(state: string) {
  const u = new URL("https://marketplace.gohighlevel.com/oauth/chooselocation");
  u.searchParams.set("response_type", "code");
  u.searchParams.set("redirect_uri", process.env.GHL_REDIRECT_URI!);
  u.searchParams.set("client_id", process.env.GHL_CLIENT_ID!);
  u.searchParams.set("scope", GHL_SCOPES.join(" "));
  u.searchParams.set("state", state);
  return u.toString();
}

export type TokenResponse = {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  scope?: string;
  userType?: string;
  companyId?: string;
  locationId?: string;
  userId?: string;
};

export function exchangeCode(code: string) {
  return ghlFetch<TokenResponse>("/oauth/token", null, {
    form: {
      client_id: process.env.GHL_CLIENT_ID!,
      client_secret: process.env.GHL_CLIENT_SECRET!,
      grant_type: "authorization_code",
      code,
      user_type: "Company",
      redirect_uri: process.env.GHL_REDIRECT_URI!,
    },
  });
}
