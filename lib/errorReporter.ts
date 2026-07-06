// Minimal Sentry envelope sender. We don't pull in @sentry/nextjs because
// the project deploys to Cloudflare Pages on the edge runtime, and the full
// SDK requires bundler config + source map upload that complicates the
// next-on-pages build. The HTTP envelope API is documented and stable:
// https://develop.sentry.dev/sdk/envelopes/
//
// Behavior:
// - If `SENTRY_DSN` is not set, this is a no-op beyond `console.error`.
// - Inside a Next.js request scope we hand the POST to `after()` so it
//   completes after the response is sent (Cloudflare Workers' equivalent
//   of `ctx.waitUntil`). Outside request scope (e.g. background tasks)
//   we fall back to fire-and-forget — the console log is the safety net.

import { after } from "next/server";

type ErrorContext = Record<string, string | number | boolean | null | undefined>;

interface ParsedDsn {
  host: string;
  projectId: string;
  publicKey: string;
}

function parseDsn(dsn: string): ParsedDsn | null {
  try {
    const url = new URL(dsn);
    const publicKey = url.username;
    const projectId = url.pathname.replace(/^\//, "");
    if (!publicKey || !projectId || !url.host) return null;
    return { host: url.host, projectId, publicKey };
  } catch {
    return null;
  }
}

const PARSED_DSN: ParsedDsn | null = (() => {
  const dsn = process.env.SENTRY_DSN;
  return dsn ? parseDsn(dsn) : null;
})();

const ENVIRONMENT = process.env.SENTRY_ENVIRONMENT ?? process.env.NODE_ENV ?? "development";

function eventId(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

async function sendEnvelope(source: string, err: unknown, extra?: ErrorContext): Promise<void> {
  if (!PARSED_DSN) return;

  const e = err instanceof Error ? err : new Error(String(err));
  const id = eventId();

  const event = {
    event_id: id,
    timestamp: Date.now() / 1000,
    platform: "javascript",
    level: "error",
    logger: source,
    environment: ENVIRONMENT,
    tags: { source, ...(extra ?? {}) },
    exception: {
      values: [
        {
          type: e.name || "Error",
          value: e.message || String(err),
          stacktrace: e.stack
            ? {
                frames: e.stack
                  .split("\n")
                  .slice(1, 11)
                  .map((line) => ({ filename: line.trim(), in_app: true })),
              }
            : undefined,
        },
      ],
    },
  };

  const body = [
    JSON.stringify({ event_id: id, sent_at: new Date().toISOString() }),
    JSON.stringify({ type: "event" }),
    JSON.stringify(event),
  ].join("\n");

  const url = `https://${PARSED_DSN.host}/api/${PARSED_DSN.projectId}/envelope/?sentry_key=${PARSED_DSN.publicKey}&sentry_version=7`;

  try {
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/x-sentry-envelope" },
      body,
      // Telemetría jamás debe retener el isolate: si Sentry no responde,
      // abandonar rápido.
      signal: AbortSignal.timeout(5_000),
    });
  } catch {
    // Sentry itself failed — nothing more we can do
  }
}

/**
 * Log an error to console and (if SENTRY_DSN is configured) ship it to Sentry.
 * `source` is a short tag like "api/search" or "fetchStockData/historical".
 * `extra` becomes Sentry tags — keep keys low-cardinality (e.g. ticker symbol).
 */
export function reportError(source: string, err: unknown, extra?: ErrorContext): void {
  console.error(`[${source}]`, err, extra ?? "");
  if (!PARSED_DSN) return;
  try {
    // `after` schedules the POST to run after the response is sent,
    // keeping the worker alive until it completes (Next.js handles the
    // Cloudflare `ctx.waitUntil` plumbing under the hood).
    after(() => sendEnvelope(source, err, extra));
  } catch {
    // Not inside a request scope — e.g. invoked from a background script
    // or module-init code. Just fire it; in Node/dev the process stays alive.
    void sendEnvelope(source, err, extra);
  }
}
