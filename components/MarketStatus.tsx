"use client";

import { useSyncExternalStore } from "react";
import { getMarketStatus, type MarketStatus as Status } from "@/lib/marketHours";

interface Props {
  tone?: "light" | "dark";
}

const DAY_ABBR: Record<string, string> = {
  lunes: "Lun",
  martes: "Mar",
  miércoles: "Mié",
  jueves: "Jue",
  viernes: "Vie",
  sábado: "Sáb",
  domingo: "Dom",
};

let cachedSnapshot: Status | null = null;
function snapshot(): Status {
  const next = getMarketStatus();
  if (
    cachedSnapshot &&
    cachedSnapshot.isOpen === next.isOpen &&
    cachedSnapshot.sessionOpen === next.sessionOpen &&
    cachedSnapshot.sessionClose === next.sessionClose &&
    cachedSnapshot.sessionIsToday === next.sessionIsToday &&
    cachedSnapshot.sessionDayLabel === next.sessionDayLabel &&
    cachedSnapshot.label === next.label &&
    cachedSnapshot.detail === next.detail
  ) {
    return cachedSnapshot;
  }
  cachedSnapshot = next;
  return next;
}
function subscribe(onChange: () => void): () => void {
  const id = setInterval(onChange, 30_000);
  return () => clearInterval(id);
}

export function MarketStatus({ tone = "light" }: Props) {
  const status = useSyncExternalStore<Status | null>(subscribe, snapshot, () => null);
  if (!status) return null;

  const dark = tone === "dark";
  const dotColor = status.isOpen ? "var(--pos)" : "var(--neg)";
  const stateColor = dark ? "rgba(255,255,255,0.82)" : "var(--ink)";
  const metaColor = dark ? "rgba(255,255,255,0.55)" : "var(--ink-3)";
  const sepColor = dark ? "rgba(255,255,255,0.25)" : "var(--rule-strong)";

  const stateWord = status.isOpen ? "abierto" : "cerrado";
  const dayPrefix = status.sessionIsToday ? null : DAY_ABBR[status.sessionDayLabel] ?? status.sessionDayLabel;

  return (
    <div
      className="inline-flex items-center gap-2"
      title={`${status.label} · ${status.detail}`}
      aria-label={`${status.label}. ${status.detail}`}
      style={{ fontFamily: "var(--font-sans)" }}
    >
      <span
        style={{
          width: 6,
          height: 6,
          background: dotColor,
          display: "inline-block",
          flexShrink: 0,
        }}
      />
      <span
        style={{
          fontSize: 11,
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          color: stateColor,
          fontWeight: 500,
        }}
      >
        Mercado {stateWord}
      </span>
      <span style={{ color: sepColor }} aria-hidden>·</span>
      <span
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 11,
          color: metaColor,
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {dayPrefix && <span style={{ marginRight: 6 }}>{dayPrefix}</span>}
        {status.sessionOpen}–{status.sessionClose}
        <span style={{ marginLeft: 6, color: sepColor }}>UY</span>
      </span>
    </div>
  );
}
