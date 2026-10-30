# God View: Multi-Tenant Analytics Hub for HighLevel

One screen for every sub-account in a HighLevel (GHL) agency:

- **Global leaderboard.** Ranks every client by lowest CPL, highest appointment show rate, most revenue, or most leads. Each cell shows the change vs the previous period. Rows are sortable and selectable, there is a daily-lead sparkline per account, and you can export to CSV.
- **Churn predictor.** A sub-account turns **red** when its lead volume stays below a threshold for N consecutive *completed* days (default 3 days under 3 leads/day). Accounts with 1–2 low days are flagged **Watch** (amber). A heatmap shows the last 14 days for every flagged account. The threshold can be set agency-wide or per account.
- **One-click snapshot push.** Click **Push** on a winning row and pick its snapshot. The tool pre-selects underperformers: everything at churn risk plus the bottom 25% on the current metric. It then pushes the snapshot to all of them in bulk, with live per-account progress. "Push a winner into this account" does the reverse for a single struggling client.
- Account drawer with daily leads vs threshold, showed/no-show appointments, revenue, and per-account overrides.
- Light and dark themes, works on mobile, and has a **demo mode** with 100 simulated clients so you can try it without a GHL app.

## Quick start

```bash
npm install
cp .env.example .env.local   # fill in values (see below)
npm run dev                  # http://localhost:3000
```

Click **Explore with demo data** to try it right away, or **Connect HighLevel agency** for live data.

## HighLevel OAuth setup

1. Go to https://marketplace.gohighlevel.com, then **My Apps**, then **Create App**.
2. **Distribution type: Agency** (Sub-account + Agency). The app must be installed at the agency level. The callback rejects sub-account-only installs, because a location token can't see other clients.
3. Add the **Redirect URL** `https://<your-host>/api/auth/callback` (use `http://localhost:3000/api/auth/callback` for local work).
4. Add these **scopes**:
   `locations.readonly locations.write locations/customValues.readonly oauth.readonly oauth.write companies.readonly contacts.readonly opportunities.readonly calendars.readonly calendars/events.readonly snapshots.readonly`
5. Copy the Client ID and Secret into `.env.local`. Set `GHL_APP_ID` (the part of the client ID before the `-`) so only sub-accounts with the app installed are synced.

### How the OAuth flow works

```
/api/auth/login ─► marketplace.gohighlevel.com/oauth/chooselocation (state cookie)
                   ◄─ /api/auth/callback?code=…
POST /oauth/token (user_type=Company) ─► agency access + refresh token (stored server-side)
for each sub-account: POST /oauth/locationToken ─► location token (cached ~24h)
```

- Agency tokens refresh automatically before they expire. Refresh tokens are single-use, so concurrent callers share one refresh.
- Location tokens are minted once per sub-account, even when several fetches run in parallel.
- The browser only holds a signed, httpOnly session cookie with the company ID. Tokens never reach the client.

## Where each number comes from

| Metric | GHL source |
|---|---|
| Leads | `POST /contacts/search`: contacts by `dateAdded`, bucketed in the sub-account's timezone |
| Revenue | `GET /opportunities/search?status=won`: `monetaryValue`, dated by `lastStatusChangeAt` (looks back 120 extra days of creation date so long-cycle deals count) |
| Show rate | `GET /calendars/events` across every calendar: `showed / (showed + noshow)` |
| Ad spend / CPL | HighLevel has **no public ads-reporting API**, so spend comes from a sub-account **custom value** (default key `ad_spend_daily`). It can hold a daily number (`"42.50"`) or JSON per day (`{"2026-10-29": 41.2}`). Agencies usually fill it from Meta/Google Ads with Zapier, Make or n8n. You can also type a daily spend override per account in the drawer. |
| Snapshot push | `GET /snapshots` lists them, `PUT /locations/{id}` with `{ snapshot: { id, override } }` pushes one, `GET /snapshots/snapshot-status/{snapshotId}/location/{id}` reports progress |

**Pushing a single funnel or workflow:** HighLevel distributes assets through snapshots. Create a snapshot from the winning sub-account that contains only that funnel or workflow (Agency → Account Snapshots), then push it. With **override off**, the push only adds assets. Turning override on replaces assets that have the same name, and the UI asks for an explicit confirmation first.

## Sync

- **Sync** in the header pulls every sub-account (4 at a time; 429/5xx responses are retried with backoff) over the configured window (default 60 days, which covers a 30-day view plus its comparison period).
- A fresh agency install triggers a sync automatically.
- If one sub-account fails (for example, the app isn't installed there), only that row is flagged and the rest of the sync continues.
- For scheduled syncs, call `POST /api/sync` from a cron job with the session cookie, or wire `startSync()` into your job runner.

## Architecture

```
src/lib/ghl/client.ts     fetch wrapper (Version header, retries), agency/location token management
src/lib/ghl/oauth.ts      authorize URL, code exchange, scopes
src/lib/ghl/resources.ts  locations, contacts, opportunities, calendars, custom values, snapshots
src/lib/sync.ts           per-sub-account aggregation into daily metrics
src/lib/metrics.ts        leaderboard / churn / totals for a date range
src/lib/push.ts           snapshot push jobs and status polling
src/lib/store.ts          JSON-file store per agency (data/company-<id>.json)
src/components/*          dashboard UI (Next.js App Router, Tailwind, Recharts)
```

**Production notes**
- Replace the JSON file store with Postgres/Redis (it's a single `loadStore`/`saveStore` interface). Encrypt tokens at rest.
- Set a long random `SESSION_SECRET`. Production refuses to start without one.
- Syncs and pushes run in-process, so deploy to a long-running Node host (Render, Fly, a VM) or move `startSync` and the push runner into a queue worker. Serverless function timeouts will cut long syncs short.
- `GHL_API_BASE` can point at a mock server for testing.
