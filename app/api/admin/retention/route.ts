import { NextRequest, NextResponse } from "next/server";
import { getMetricsDb, purgeExpiredRows } from "@/lib/metrics";
import { requireAdminToken } from "@/lib/adminAuth";

export const dynamic = "force-dynamic";

const DEFAULT_RETENTION_DAYS = 90;

// Manual retention trigger: drop analyze_events older than ?days=N (default
// 90) plus dead rate-limit windows. The app already self-purges daily (see
// purgeExpiredRows in lib/metrics.ts) — this endpoint remains for spot
// cleanups with a custom horizon.
export async function POST(req: NextRequest) {
  const denied = await requireAdminToken(req);
  if (denied) return denied;

  const db = getMetricsDb();
  if (!db) {
    return NextResponse.json({ error: "METRICS_DB binding missing" }, { status: 503 });
  }

  const daysParam = Number(req.nextUrl.searchParams.get("days"));
  const days = Number.isFinite(daysParam) && daysParam > 0 && daysParam <= 365
    ? Math.floor(daysParam)
    : DEFAULT_RETENTION_DAYS;

  const deleted = await purgeExpiredRows(db, days);

  return NextResponse.json({
    ok: true,
    deletedRows: deleted.events,
    deletedRateLimitRows: deleted.rateLimits,
    retentionDays: days,
  });
}

// GET also allowed for cron-job.org style triggers that can't issue POSTs.
export const GET = POST;
