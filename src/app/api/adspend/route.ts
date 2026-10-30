import { NextResponse } from "next/server";
import { getStoreForSession, unauthorized } from "@/lib/context";
import { saveStore } from "@/lib/store";
import { normaliseDate, parseCsv } from "@/lib/csv";

export const dynamic = "force-dynamic";

const ACCOUNT_COLS = ["location_id", "locationid", "sub_account_id", "account_id", "id", "sub_account", "account", "location", "name", "client"];
const DATE_COLS = ["date", "day"];
const SPEND_COLS = ["spend", "amount", "cost", "ad_spend", "amount_spent"];

/** Template CSV with every sub-account and yesterday's date. */
export async function GET() {
  const store = await getStoreForSession();
  if (!store) return unauthorized();
  const d = new Date(Date.now() - 86400_000).toISOString().slice(0, 10);
  const esc = (s: string) => `"${s.replace(/"/g, '""')}"`;
  const lines = ["location_id,name,date,spend", ...Object.values(store.accounts).map((a) => `${a.id},${esc(a.name)},${d},`)];
  return new NextResponse(lines.join("\n"), {
    headers: { "Content-Type": "text/csv", "Content-Disposition": 'attachment; filename="ad-spend-template.csv"' },
  });
}

/** Body: { csv: string, replace?: boolean }. Columns: account (id or name), date, spend. */
export async function POST(req: Request) {
  const store = await getStoreForSession();
  if (!store) return unauthorized();
  const body = await req.json().catch(() => ({}));
  if (typeof body.csv !== "string" || !body.csv.trim()) return NextResponse.json({ error: "Empty CSV" }, { status: 400 });
  if (body.csv.length > 5_000_000) return NextResponse.json({ error: "CSV too large (5 MB max)" }, { status: 413 });

  const rows = parseCsv(body.csv);
  const header = rows.shift()?.map((h) => h.trim().toLowerCase().replace(/[\s-]+/g, "_")) ?? [];
  const col = (names: string[]) => names.map((n) => header.indexOf(n)).find((i) => i >= 0) ?? -1;
  const idCols = ACCOUNT_COLS.map((n) => header.indexOf(n)).filter((i) => i >= 0);
  const dCol = col(DATE_COLS), sCol = col(SPEND_COLS);
  if (!idCols.length || dCol < 0 || sCol < 0) {
    return NextResponse.json({ error: "CSV needs an account column (location_id or name), a date column and a spend column" }, { status: 400 });
  }

  const byName = new Map(Object.values(store.accounts).map((a) => [a.name.trim().toLowerCase(), a]));
  if (body.replace) for (const a of Object.values(store.accounts)) a.importedSpend = undefined;

  let imported = 0, invalid = 0;
  const unmatched = new Set<string>();
  const touched = new Set<string>();
  for (const r of rows) {
    let acc;
    for (const i of idCols) {
      const v = (r[i] ?? "").trim();
      acc = store.accounts[v] ?? byName.get(v.toLowerCase());
      if (acc) break;
    }
    const date = normaliseDate(r[dCol] ?? "");
    const spend = Number(String(r[sCol] ?? "").replace(/[$,\s]/g, ""));
    if (!acc) { unmatched.add((r[idCols[0]] ?? "").trim() || "(blank)"); continue; }
    if (!date || !Number.isFinite(spend) || spend < 0 || String(r[sCol] ?? "").trim() === "") { invalid++; continue; }
    (acc.importedSpend ??= {})[date] = Math.round(spend * 100) / 100;
    touched.add(acc.id);
    imported++;
  }
  await saveStore(store);
  return NextResponse.json({ rows: rows.length, imported, accounts: touched.size, invalid, unmatched: [...unmatched].slice(0, 50) });
}

export async function DELETE() {
  const store = await getStoreForSession();
  if (!store) return unauthorized();
  for (const a of Object.values(store.accounts)) a.importedSpend = undefined;
  await saveStore(store);
  return NextResponse.json({ ok: true });
}
