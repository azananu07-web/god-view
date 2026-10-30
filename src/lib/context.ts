import { NextResponse } from "next/server";
import { getSessionCompanyId } from "./session";
import { loadStore, saveStore } from "./store";
import { buildDemoStore } from "./demo";
import type { CompanyStore } from "./types";

export async function getStoreForSession(): Promise<CompanyStore | null> {
  const companyId = getSessionCompanyId();
  if (!companyId) return null;
  let store = await loadStore(companyId);
  if (!store && companyId === "demo") {
    store = buildDemoStore();
    await saveStore(store);
  }
  return store;
}

export const unauthorized = () => NextResponse.json({ error: "Not signed in" }, { status: 401 });
