// Staleness heuristic for the analysis snapshot.
//
// The /analyze report is a consistent point-in-time snapshot by design — header
// price, metrics, chart and valuation all come from the same cached moment, and
// nothing is live (a plain F5 never refetches; only "Actualizar Análisis" does).
// That consistency is the whole point, but it means a snapshot served late in
// its cache window can quietly drift from the market. This decides when the
// snapshot is old enough that the reader should be nudged to re-run it — using
// ONLY the snapshot's own createdAt (`analyzedAt`), no live fetch.
//
// Staleness is really about how much MARKET time has elapsed, not wall-clock:
// a snapshot taken at 3pm and read at 10pm barely drifted (market closed at
// 4pm), while one taken at 10am and read at 3pm has seen most of a session. We
// approximate that with a lower threshold during US market hours and a higher
// one off-hours, rather than a full trading-calendar computation.

export interface SnapshotFreshness {
  ageMs: number;
  stale: boolean;
}

const HOUR = 3_600_000;
const STALE_MARKET_HOURS_H = 3; // market open: prices move → nudge sooner
const STALE_OFF_HOURS_H = 8;    // market closed: a stale price barely matters

// Mon–Fri, 09:30–16:00 America/New_York. Intl resolves ET (incl. DST) for us;
// holidays are ignored (a rare false "open" only makes the nudge slightly more
// eager, never wrong). h23 hourCycle so midnight reads 00, not 24.
function isUsMarketHours(now: Date): boolean {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const wd = get("weekday");
  if (wd === "Sat" || wd === "Sun") return false;
  const mins = parseInt(get("hour"), 10) * 60 + parseInt(get("minute"), 10);
  return mins >= 570 && mins < 960; // 9:30 → 16:00
}

export function snapshotFreshness(
  analyzedAt: number | undefined | null,
  now: Date = new Date(),
): SnapshotFreshness {
  if (analyzedAt == null) return { ageMs: 0, stale: false };
  const ageMs = now.getTime() - analyzedAt;
  if (ageMs <= 0) return { ageMs: 0, stale: false };
  const thresholdH = isUsMarketHours(now) ? STALE_MARKET_HOURS_H : STALE_OFF_HOURS_H;
  return { ageMs, stale: ageMs >= thresholdH * HOUR };
}
