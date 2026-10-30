export type DailyMetric = {
  date: string; // YYYY-MM-DD in the sub-account's timezone
  leads: number;
  booked: number;
  showed: number;
  noShow: number;
  revenue: number;
  spend: number;
};

export type Account = {
  id: string;
  name: string;
  city?: string;
  state?: string;
  timezone?: string;
  daily: DailyMetric[];
  lastSyncedAt?: string;
  syncError?: string;
  /** Per-account overrides set from the dashboard. */
  dailySpendOverride?: number;
  churnThresholdOverride?: number;
  /** Spend imported from CSV, keyed by YYYY-MM-DD. Takes precedence over synced spend. */
  importedSpend?: Record<string, number>;
};

export type Settings = {
  /** A day with fewer leads than this counts as a "low" day. */
  churnThreshold: number;
  /** Consecutive low days before an account is flagged red. */
  churnDays: number;
  /** Custom value key on each sub-account holding ad spend. */
  adSpendCustomValueKey: string;
  /** Days of history to pull on each sync. */
  syncWindowDays: number;
  /** Slack-compatible incoming webhook for churn alerts (POST {text}). */
  alertWebhookUrl?: string;
  /** Also alert when a red account recovers. */
  alertOnRecovery?: boolean;
};

export type PushTargetStatus = "queued" | "pushing" | "processing" | "completed" | "failed";

export type PushJob = {
  id: string;
  createdAt: string;
  snapshotId: string;
  snapshotName: string;
  sourceLocationId?: string;
  sourceName?: string;
  override: boolean;
  targets: {
    locationId: string;
    name: string;
    status: PushTargetStatus;
    message?: string;
    updatedAt: string;
  }[];
};

export type AuthTokens = {
  companyId: string;
  userId?: string;
  accessToken: string;
  refreshToken: string;
  expiresAt: number; // epoch ms
  scope?: string;
};

export type SyncState = {
  running: boolean;
  startedAt?: string;
  finishedAt?: string;
  total: number;
  done: number;
  errors: number;
  message?: string;
};

export type CompanyStore = {
  companyId: string;
  companyName?: string;
  mode: "live" | "demo";
  auth?: AuthTokens;
  locationTokens: Record<string, { token: string; expiresAt: number }>;
  accounts: Record<string, Account>;
  settings: Settings;
  pushJobs: PushJob[];
  sync: SyncState;
  /** Accounts we've already sent a churn alert for (cleared on recovery). */
  alertedChurn?: string[];
  /** Recent webhook ids, for idempotency. */
  processedWebhooks?: string[];
  /** Set when the agency uninstalls the app. */
  uninstalledAt?: string;
};

export type Snapshot = { id: string; name: string; type?: string };

export type AccountStatus = "churn" | "watch" | "healthy" | "error";

export type AccountMetrics = {
  id: string;
  name: string;
  location: string;
  status: AccountStatus;
  lowStreak: number;
  threshold: number;
  leads: number;
  spend: number;
  cpl: number | null;
  booked: number;
  showed: number;
  noShow: number;
  showRate: number | null;
  revenue: number;
  leadsPrev: number;
  revenuePrev: number;
  cplPrev: number | null;
  showRatePrev: number | null;
  series: DailyMetric[]; // range days, oldest -> newest
  syncError?: string;
  lastSyncedAt?: string;
  dailySpendOverride?: number;
  churnThresholdOverride?: number;
};

export type DashboardPayload = {
  mode: "live" | "demo";
  companyName: string;
  days: number;
  dates: string[];
  settings: Settings;
  sync: SyncState;
  accounts: AccountMetrics[];
  totals: {
    accounts: number;
    leads: number;
    spend: number;
    cpl: number | null;
    showRate: number | null;
    revenue: number;
    churn: number;
    watch: number;
    leadsPrev: number;
    revenuePrev: number;
    cplPrev: number | null;
    showRatePrev: number | null;
  };
  daily: { date: string; leads: number; revenue: number; showed: number; noShow: number }[];
};
