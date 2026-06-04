import { NextRequest, NextResponse } from "next/server";
import { getMetricsDb } from "@/lib/metrics";
import { requireAdminToken } from "@/lib/adminAuth";

export const runtime = "edge";
export const dynamic = "force-dynamic";

const DEFAULT_RETENTION_DAYS = 90;
const DAY_MS = 24 * 60 * 60 * 1000;

// Drop analyze_events older than ?days=N (default 90). Idempotent — safe to
// hit on a daily cron from a separate Cloudflare Worker, an external scheduler,
// or manually for spot cleanups.
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

  const cutoff = Date.now() - days * DAY_MS;
  // Rate-limit counters: drop windows that ended more than 2 days ago. The
  // longest window is the daily fresh cap, so anything older is dead weight.
  const rateLimitCutoff = Date.now() - 2 * DAY_MS;
  const [result, rlResult] = (await db.batch([
    db.prepare("DELETE FROM analyze_events WHERE ts < ?").bind(cutoff),
    db.prepare("DELETE FROM rate_limits WHERE window_start < ?").bind(rateLimitCutoff),
  ])) as Array<{ meta?: { changes?: number } }>;

  return NextResponse.json({
    ok: true,
    deletedRows: result?.meta?.changes ?? null,
    deletedRateLimitRows: rlResult?.meta?.changes ?? null,
    cutoff,
    retentionDays: days,
  });
}

// GET also allowed for cron-job.org style triggers that can't issue POSTs.
export const GET = POST;
