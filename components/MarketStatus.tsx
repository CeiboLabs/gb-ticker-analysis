"use client";

import { useEffect, useState } from "react";
import { getMarketStatus, type MarketStatus as Status } from "@/lib/marketHours";

interface Props {
  /** Background tone the badge sits on. */
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

export function MarketStatus({ tone = "light" }: Props) {
  const [status, setStatus] = useState<Status | null>(null);

  useEffect(() => {
    setStatus(getMarketStatus());
    const id = setInterval(() => setStatus(getMarketStatus()), 30_000);
    return () => clearInterval(id);
  }, []);

  if (!status) return null;

  const dark = tone === "dark";
  const dotColor = status.isOpen ? "bg-emerald-500" : "bg-red-500";
  const ringColor = status.isOpen ? "bg-emerald-500/40" : "bg-red-500/30";

  const stateWord = status.isOpen ? "Abierto" : "Cerrado";
  const dayPrefix = status.sessionIsToday ? null : DAY_ABBR[status.sessionDayLabel] ?? status.sessionDayLabel;

  const stateTheme = dark ? "text-white" : "text-[#03065E]";
  const timeTheme = dark ? "text-white/55" : "text-[#03065E]/55";
  const sepTheme = dark ? "text-white/20" : "text-[#03065E]/15";
  const tzTheme = dark ? "text-white/35" : "text-[#03065E]/35";

  return (
    <div
      className="inline-flex items-center gap-2"
      title={`${status.label} · ${status.detail}`}
      aria-label={`${status.label}. ${status.detail}`}
    >
      <span className="relative flex h-1.5 w-1.5 shrink-0">
        {status.isOpen && (
          <span className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-75 ${ringColor}`} />
        )}
        <span className={`relative inline-flex h-1.5 w-1.5 rounded-full ${dotColor}`} />
      </span>

      <span className={`text-[11px] font-medium ${stateTheme}`}>
        Mercado {stateWord.toLowerCase()}
      </span>

      <span className={`text-[10px] ${sepTheme}`} aria-hidden>·</span>

      <span className={`font-mono text-[11px] tabular-nums ${timeTheme}`}>
        {dayPrefix && <span className={`${tzTheme} mr-1`}>{dayPrefix}</span>}
        {status.sessionOpen}–{status.sessionClose}
        <span className={`${tzTheme} ml-1`}>UY</span>
      </span>
    </div>
  );
}
