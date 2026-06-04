import { NextRequest, NextResponse } from "next/server";
import { getMetricsDb } from "@/lib/metrics";
import { requireAdminToken } from "@/lib/adminAuth";

export const runtime = "edge";
export const dynamic = "force-dynamic";

const DAY_MS = 24 * 60 * 60 * 1000;

interface CountRow { n: number }
interface StatusRow { status: string; n: number }
interface TickerRow { ticker: string; total: number; errors: number }
interface SourceRow { sankey_source: string | null; n: number }
interface StageRow  { error_stage: string | null; n: number }
interface DurRow    { duration_ms: number | null }
interface RecentErrorRow {
  ts: number;
  ticker: string;
  status: string;
  error_stage: string | null;
  error_msg: string | null;
  sankey_source: string | null;
  duration_ms: number | null;
  country: string | null;
}
interface TimeseriesRow { bucket: number; status: string; n: number }

function percentile(values: number[], p: number): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return sorted[idx];
}

export async function GET(req: NextRequest) {
  const denied = await requireAdminToken(req);
  if (denied) return denied;

  const db = getMetricsDb();
  if (!db) {
    return NextResponse.json(
      { error: "metrics db not configured (METRICS_DB binding missing)" },
      { status: 503 }
    );
  }

  const now = Date.now();
  const t24h = now - DAY_MS;
  const t7d  = now - 7 * DAY_MS;
  const t30d = now - 30 * DAY_MS;

  // "Hoy" en hora Uruguay (UTC-3, sin DST): inicio del día calendario UY
  // expresado como timestamp UTC en ms.
  const UY_OFFSET_MS = 3 * 60 * 60 * 1000;
  const tTodayUY = Math.floor((now - UY_OFFSET_MS) / DAY_MS) * DAY_MS + UY_OFFSET_MS;

  // Summary counts (24h, 7d, 30d) by status
  const [byStatus24, byStatus7d, byStatus30d] = await Promise.all([
    db.prepare("SELECT status, COUNT(*) AS n FROM analyze_events WHERE ts >= ? GROUP BY status").bind(t24h).all<StatusRow>(),
    db.prepare("SELECT status, COUNT(*) AS n FROM analyze_events WHERE ts >= ? GROUP BY status").bind(t7d).all<StatusRow>(),
    db.prepare("SELECT status, COUNT(*) AS n FROM analyze_events WHERE ts >= ? GROUP BY status").bind(t30d).all<StatusRow>(),
  ]);

  // Top failing tickers — last 7d, sorted by error count desc
  const failingTickers = await db.prepare(
    "SELECT ticker, " +
    "       COUNT(*) AS total, " +
    "       SUM(CASE WHEN status = 'error' THEN 1 ELSE 0 END) AS errors " +
    "FROM analyze_events " +
    "WHERE ts >= ? AND ticker != '-' " +
    "GROUP BY ticker " +
    "HAVING errors > 0 " +
    "ORDER BY errors DESC, total DESC " +
    "LIMIT 20"
  ).bind(t7d).all<TickerRow>();

  // Sankey source distribution (7d, ok + cache_hit only — these produced charts)
  const sourceMix = await db.prepare(
    "SELECT sankey_source, COUNT(*) AS n " +
    "FROM analyze_events " +
    "WHERE ts >= ? AND status IN ('ok', 'cache_hit') " +
    "GROUP BY sankey_source " +
    "ORDER BY n DESC"
  ).bind(t7d).all<SourceRow>();

  // Errors broken down by stage (7d)
  const errorsByStage = await db.prepare(
    "SELECT error_stage, COUNT(*) AS n " +
    "FROM analyze_events " +
    "WHERE ts >= ? AND status = 'error' " +
    "GROUP BY error_stage " +
    "ORDER BY n DESC"
  ).bind(t7d).all<StageRow>();

  // Latency — pull raw durations for 24h ok/cache_hit, compute p50/p95 in JS
  // (D1/SQLite has no built-in percentile and the volume is small enough).
  const durations = await db.prepare(
    "SELECT duration_ms FROM analyze_events " +
    "WHERE ts >= ? AND status IN ('ok', 'cache_hit') AND duration_ms IS NOT NULL"
  ).bind(t24h).all<DurRow>();
  const dvals = durations.results
    .map((r) => r.duration_ms)
    .filter((v): v is number => typeof v === "number");

  // Recent errors (top 50, newest first) for the dashboard tail
  const recentErrors = await db.prepare(
    "SELECT ts, ticker, status, error_stage, error_msg, sankey_source, duration_ms, country " +
    "FROM analyze_events " +
    "WHERE status = 'error' " +
    "ORDER BY ts DESC " +
    "LIMIT 50"
  ).all<RecentErrorRow>();

  // EDGAR/segments availability (24h) — surfacing degradation in upstreams.
  const upstream = await db
    .prepare(
      "SELECT " +
      "  SUM(CASE WHEN edgar_8k_ok = 1 THEN 1 ELSE 0 END) AS edgar_ok, " +
      "  SUM(CASE WHEN edgar_8k_ok = 0 THEN 1 ELSE 0 END) AS edgar_fail, " +
      "  SUM(CASE WHEN segments_ok = 1 THEN 1 ELSE 0 END) AS segments_ok, " +
      "  SUM(CASE WHEN segments_ok = 0 THEN 1 ELSE 0 END) AS segments_fail " +
      "FROM analyze_events WHERE ts >= ?"
    )
    .bind(t24h)
    .first<{ edgar_ok: number | null; edgar_fail: number | null; segments_ok: number | null; segments_fail: number | null }>();

  // Hourly timeseries for the last 24h, by status. Groups via integer division
  // on the unix timestamp; SQLite handles this in-engine without tz games.
  const HOUR_MS = 60 * 60 * 1000;
  const series = await db.prepare(
    "SELECT (ts / ?) AS bucket, status, COUNT(*) AS n " +
    "FROM analyze_events " +
    "WHERE ts >= ? " +
    "GROUP BY bucket, status " +
    "ORDER BY bucket ASC"
  ).bind(HOUR_MS, t24h).all<TimeseriesRow>();

  const oldest = await db
    .prepare("SELECT COUNT(*) AS n FROM analyze_events")
    .first<CountRow>();

  // Volume counts for the analyses dashboard. "Today" usa el día calendario
  // en hora Uruguay (UTC-3) — desde la medianoche UY hasta ahora. All-time
  // counts only completed analyses (status ok or cache_hit), excluding
  // errors / rate limits / bad requests.
  const successFilter = "status IN ('ok', 'cache_hit')";
  const counts = await db
    .prepare(
      "SELECT " +
      "  SUM(CASE WHEN ts >= ? AND " + successFilter + " THEN 1 ELSE 0 END) AS today, " +
      "  SUM(CASE WHEN ts >= ? AND " + successFilter + " THEN 1 ELSE 0 END) AS week, " +
      "  SUM(CASE WHEN " + successFilter + " THEN 1 ELSE 0 END) AS allTime, " +
      "  COUNT(DISTINCT CASE WHEN ts >= ? AND " + successFilter + " THEN ticker END) AS uniqueWeek, " +
      "  COUNT(DISTINCT CASE WHEN " + successFilter + " THEN ticker END) AS uniqueAllTime " +
      "FROM analyze_events"
    )
    .bind(tTodayUY, t7d, t7d)
    .first<{ today: number; week: number; allTime: number; uniqueWeek: number; uniqueAllTime: number }>();

  // Daily volume for the last 30 days — used by the dashboard's bar chart.
  // Bucket on UTC day so each bar represents one calendar day.
  const t30dStart = now - 30 * DAY_MS;
  const dailyVolume = await db
    .prepare(
      "SELECT (ts / ?) AS bucket, " +
      "       SUM(CASE WHEN status = 'ok' THEN 1 ELSE 0 END) AS fresh, " +
      "       SUM(CASE WHEN status = 'cache_hit' THEN 1 ELSE 0 END) AS cached, " +
      "       SUM(CASE WHEN status = 'error' THEN 1 ELSE 0 END) AS errors " +
      "FROM analyze_events " +
      "WHERE ts >= ? " +
      "GROUP BY bucket " +
      "ORDER BY bucket ASC"
    )
    .bind(DAY_MS, t30dStart)
    .all<{ bucket: number; fresh: number; cached: number; errors: number }>();

  // Most popular completed analyses with verdict + market snapshot. We pull
  // the most recent verdict per ticker via a correlated subquery so the
  // table reflects the latest decision, not the first one. Search count is
  // total successful runs to date.
  const popularAnalyses = await db
    .prepare(
      "SELECT a.ticker, " +
      "       COUNT(*) AS searches, " +
      "       COUNT(DISTINCT a.ip_hash) AS uniques, " +
      "       MAX(a.ts) AS last_ts, " +
      "       (SELECT verdict_rating     FROM analyze_events WHERE ticker = a.ticker AND verdict_rating     IS NOT NULL ORDER BY ts DESC LIMIT 1) AS verdict_rating, " +
      "       (SELECT verdict_conviction FROM analyze_events WHERE ticker = a.ticker AND verdict_conviction IS NOT NULL ORDER BY ts DESC LIMIT 1) AS verdict_conviction, " +
      "       (SELECT verdict_rationale  FROM analyze_events WHERE ticker = a.ticker AND verdict_rationale  IS NOT NULL ORDER BY ts DESC LIMIT 1) AS verdict_rationale, " +
      "       (SELECT company_name       FROM analyze_events WHERE ticker = a.ticker AND company_name       IS NOT NULL ORDER BY ts DESC LIMIT 1) AS company_name, " +
      "       (SELECT current_price      FROM analyze_events WHERE ticker = a.ticker AND current_price      IS NOT NULL ORDER BY ts DESC LIMIT 1) AS current_price, " +
      "       (SELECT market_cap         FROM analyze_events WHERE ticker = a.ticker AND market_cap         IS NOT NULL ORDER BY ts DESC LIMIT 1) AS market_cap, " +
      "       (SELECT bull_target        FROM analyze_events WHERE ticker = a.ticker AND bull_target        IS NOT NULL ORDER BY ts DESC LIMIT 1) AS bull_target, " +
      "       (SELECT bear_target        FROM analyze_events WHERE ticker = a.ticker AND bear_target        IS NOT NULL ORDER BY ts DESC LIMIT 1) AS bear_target, " +
      "       (SELECT quality_score      FROM analyze_events WHERE ticker = a.ticker AND quality_score      IS NOT NULL ORDER BY ts DESC LIMIT 1) AS last_quality_score " +
      "FROM analyze_events a " +
      "WHERE a.ticker != '-' AND a.status IN ('ok', 'cache_hit') " +
      "GROUP BY a.ticker " +
      "ORDER BY searches DESC " +
      "LIMIT 30"
    )
    .all<{
      ticker: string;
      searches: number;
      uniques: number;
      last_ts: number;
      verdict_rating: string | null;
      verdict_conviction: string | null;
      verdict_rationale: string | null;
      company_name: string | null;
      current_price: number | null;
      market_cap: number | null;
      bull_target: string | null;
      bear_target: string | null;
      last_quality_score: number | null;
    }>();

  // Most recent analyses, distinct by ticker — we want the freshest verdict
  // per ticker on the front page, not 5 rows of the same ticker spamming.
  const recentAnalyses = await db
    .prepare(
      "SELECT ticker, MAX(ts) AS ts, " +
      "       (SELECT verdict_rating     FROM analyze_events e2 WHERE e2.ticker = e.ticker AND e2.verdict_rating IS NOT NULL ORDER BY ts DESC LIMIT 1) AS verdict_rating, " +
      "       (SELECT verdict_conviction FROM analyze_events e2 WHERE e2.ticker = e.ticker AND e2.verdict_conviction IS NOT NULL ORDER BY ts DESC LIMIT 1) AS verdict_conviction, " +
      "       (SELECT company_name       FROM analyze_events e2 WHERE e2.ticker = e.ticker AND e2.company_name IS NOT NULL ORDER BY ts DESC LIMIT 1) AS company_name, " +
      "       (SELECT current_price      FROM analyze_events e2 WHERE e2.ticker = e.ticker AND e2.current_price IS NOT NULL ORDER BY ts DESC LIMIT 1) AS current_price, " +
      "       (SELECT market_cap         FROM analyze_events e2 WHERE e2.ticker = e.ticker AND e2.market_cap IS NOT NULL ORDER BY ts DESC LIMIT 1) AS market_cap, " +
      "       (SELECT quality_score      FROM analyze_events e2 WHERE e2.ticker = e.ticker AND e2.quality_score IS NOT NULL ORDER BY ts DESC LIMIT 1) AS last_quality_score " +
      "FROM analyze_events e " +
      "WHERE ticker != '-' AND status IN ('ok', 'cache_hit') " +
      "GROUP BY ticker " +
      "ORDER BY ts DESC " +
      "LIMIT 20"
    )
    .all<{
      ticker: string;
      ts: number;
      verdict_rating: string | null;
      verdict_conviction: string | null;
      company_name: string | null;
      current_price: number | null;
      market_cap: number | null;
      last_quality_score: number | null;
    }>();

  // Quality aggregates — only over rows where we computed a score (success/cache_hit)
  const qualitySummary = await db
    .prepare(
      "SELECT " +
      "  COUNT(*) AS n, " +
      "  AVG(quality_score) AS avg_score, " +
      "  SUM(CASE WHEN has_segments = 1 THEN 1 ELSE 0 END) AS with_segments, " +
      "  SUM(CASE WHEN has_opex_breakdown = 1 THEN 1 ELSE 0 END) AS with_opex_breakdown, " +
      "  AVG(segment_balance_pct) AS avg_seg_imbalance, " +
      "  AVG(opex_balance_pct) AS avg_opex_imbalance, " +
      "  AVG(cost_balance_pct) AS avg_cost_imbalance " +
      "FROM analyze_events " +
      "WHERE ts >= ? AND quality_score IS NOT NULL"
    )
    .bind(t7d)
    .first<{
      n: number;
      avg_score: number | null;
      with_segments: number | null;
      with_opex_breakdown: number | null;
      avg_seg_imbalance: number | null;
      avg_opex_imbalance: number | null;
      avg_cost_imbalance: number | null;
    }>();

  // Quality buckets (7d) — distribution of scores
  const qualityBuckets = await db
    .prepare(
      "SELECT " +
      "  CASE " +
      "    WHEN quality_score >= 90 THEN '90-100' " +
      "    WHEN quality_score >= 70 THEN '70-89' " +
      "    WHEN quality_score >= 50 THEN '50-69' " +
      "    WHEN quality_score >= 30 THEN '30-49' " +
      "    ELSE '0-29' " +
      "  END AS bucket, " +
      "  COUNT(*) AS n " +
      "FROM analyze_events " +
      "WHERE ts >= ? AND quality_score IS NOT NULL " +
      "GROUP BY bucket " +
      "ORDER BY bucket DESC"
    )
    .bind(t7d)
    .all<{ bucket: string; n: number }>();

  // Per-ticker quality (7d) — show worst offenders
  const lowQualityTickers = await db
    .prepare(
      "SELECT ticker, " +
      "       COUNT(*) AS n, " +
      "       AVG(quality_score) AS avg_score, " +
      "       MIN(quality_score) AS min_score, " +
      "       AVG(segment_balance_pct) AS avg_seg_imbalance, " +
      "       AVG(opex_balance_pct) AS avg_opex_imbalance " +
      "FROM analyze_events " +
      "WHERE ts >= ? AND quality_score IS NOT NULL AND ticker != '-' " +
      "GROUP BY ticker " +
      "HAVING avg_score < 80 " +
      "ORDER BY avg_score ASC, n DESC " +
      "LIMIT 25"
    )
    .bind(t7d)
    .all<{
      ticker: string;
      n: number;
      avg_score: number | null;
      min_score: number | null;
      avg_seg_imbalance: number | null;
      avg_opex_imbalance: number | null;
    }>();

  // Flag frequency (7d) — split the comma-joined column at read time. SQLite
  // has no native split; we pull the raw column and count in JS. Volume is
  // bounded (one row per request) so this is fine for a 7d window.
  const flagRows = await db
    .prepare(
      "SELECT quality_flags FROM analyze_events " +
      "WHERE ts >= ? AND quality_flags IS NOT NULL AND quality_flags != ''"
    )
    .bind(t7d)
    .all<{ quality_flags: string }>();
  const flagCounts: Record<string, number> = {};
  for (const r of flagRows.results) {
    for (const f of r.quality_flags.split(",").map((s) => s.trim()).filter(Boolean)) {
      flagCounts[f] = (flagCounts[f] ?? 0) + 1;
    }
  }
  const flagBreakdown = Object.entries(flagCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([flag, n]) => ({ flag, n }));

  // Top tickers (last 7d) — uses ip_hash COUNT(DISTINCT) for "unique users"
  // alongside total searches, so we can tell viral spikes from one heavy user.
  const topTickers7d = await db
    .prepare(
      "SELECT ticker, " +
      "       COUNT(*) AS searches, " +
      "       COUNT(DISTINCT ip_hash) AS uniques, " +
      "       MAX(ts) AS last_ts " +
      "FROM analyze_events " +
      "WHERE ts >= ? AND ticker != '-' " +
      "GROUP BY ticker " +
      "ORDER BY searches DESC " +
      "LIMIT 25"
    )
    .bind(t7d)
    .all<{ ticker: string; searches: number; uniques: number; last_ts: number }>();

  // Top tickers — histórico (capped to whatever retention keeps in the table,
  // 90d by default). Same shape as the 7-day table.
  const topTickersAllTime = await db
    .prepare(
      "SELECT ticker, " +
      "       COUNT(*) AS searches, " +
      "       COUNT(DISTINCT ip_hash) AS uniques, " +
      "       MAX(ts) AS last_ts, " +
      "       MIN(ts) AS first_ts " +
      "FROM analyze_events " +
      "WHERE ticker != '-' " +
      "GROUP BY ticker " +
      "ORDER BY searches DESC " +
      "LIMIT 50"
    )
    .all<{ ticker: string; searches: number; uniques: number; last_ts: number; first_ts: number }>();

  // Recent events feed — by default shows only quality issues (score < 80)
  // but the dashboard can request "all" via ?scope=all to include healthy
  // Sankeys too. Either way: capped to last 30 in the 7-day window.
  const scope = req.nextUrl.searchParams.get("scope") ?? "issues";
  const includeAll = scope === "all";
  const lowQualityWhere = includeAll
    ? "WHERE ts >= ? AND quality_score IS NOT NULL AND ticker != '-' "
    : "WHERE ts >= ? AND quality_score IS NOT NULL AND quality_score < 80 AND ticker != '-' ";
  const lowQualityEventsRaw = await db
    .prepare(
      "SELECT id, ts, ticker, status, sankey_source, quality_score, " +
      "       segment_balance_pct, opex_balance_pct, cost_balance_pct, " +
      "       quality_findings " +
      "FROM analyze_events " +
      lowQualityWhere +
      "ORDER BY ts DESC " +
      "LIMIT 30"
    )
    .bind(t7d)
    .all<{
      id: number;
      ts: number;
      ticker: string;
      status: string;
      sankey_source: string | null;
      quality_score: number;
      segment_balance_pct: number | null;
      opex_balance_pct: number | null;
      cost_balance_pct: number | null;
      quality_findings: string | null;
    }>();
  const lowQualityEvents = lowQualityEventsRaw.results.map((r) => {
    let findings: unknown = null;
    if (r.quality_findings) {
      try { findings = JSON.parse(r.quality_findings); } catch { /* ignore */ }
    }
    return {
      id: r.id,
      ts: r.ts,
      ticker: r.ticker,
      status: r.status,
      sankeySource: r.sankey_source,
      qualityScore: r.quality_score,
      segmentBalancePct: r.segment_balance_pct,
      opexBalancePct: r.opex_balance_pct,
      costBalancePct: r.cost_balance_pct,
      findings,
    };
  });

  return NextResponse.json({
    generatedAt: now,
    windowMs: { day: DAY_MS, week: 7 * DAY_MS, month: 30 * DAY_MS },
    totals: {
      allTime: oldest?.n ?? 0,
      byStatus24h: byStatus24.results,
      byStatus7d:  byStatus7d.results,
      byStatus30d: byStatus30d.results,
    },
    upstream: upstream ?? { edgar_ok: 0, edgar_fail: 0, segments_ok: 0, segments_fail: 0 },
    failingTickers: failingTickers.results,
    sourceMix: sourceMix.results,
    errorsByStage: errorsByStage.results,
    latency24h: {
      sampleSize: dvals.length,
      p50: percentile(dvals, 50),
      p95: percentile(dvals, 95),
      p99: percentile(dvals, 99),
      max: dvals.length ? Math.max(...dvals) : null,
    },
    recentErrors: recentErrors.results,
    timeseries24h: {
      bucketMs: HOUR_MS,
      rows: series.results.map((r) => ({ bucketMs: r.bucket * HOUR_MS, status: r.status, n: r.n })),
    },
    quality: {
      summary: qualitySummary ?? null,
      buckets: qualityBuckets.results,
      lowQualityTickers: lowQualityTickers.results,
      flagBreakdown,
      lowQualityEvents,
    },
    topTickers: {
      week: topTickers7d.results,
      allTime: topTickersAllTime.results,
    },
    analyses: {
      counts: counts ?? { today: 0, week: 0, allTime: 0, uniqueWeek: 0, uniqueAllTime: 0 },
      dailyVolume: dailyVolume.results.map((r) => ({
        bucketMs: r.bucket * DAY_MS,
        fresh: r.fresh,
        cached: r.cached,
        errors: r.errors,
      })),
      popular: popularAnalyses.results,
      recent: recentAnalyses.results,
    },
  });
}
