"use client";

import ReactMarkdown from "react-markdown";
import type { Verdict, VerdictRating, VerdictConviction } from "@/types/Report";

interface Props {
  verdict: Verdict;
}

const ratingConfig = {
  BUY: {
    bg: "bg-emerald-50",
    border: "border-emerald-200",
    text: "text-emerald-800",
    badge: "bg-emerald-600 text-white",
  },
  HOLD: {
    bg: "bg-amber-50",
    border: "border-amber-200",
    text: "text-amber-800",
    badge: "bg-amber-500 text-white",
  },
  AVOID: {
    bg: "bg-red-50",
    border: "border-red-200",
    text: "text-red-800",
    badge: "bg-red-600 text-white",
  },
} as const;

const ratingLabel: Record<VerdictRating, string> = {
  BUY: "COMPRAR",
  HOLD: "MANTENER",
  AVOID: "EVITAR",
};

const convictionLabel: Record<VerdictConviction, string> = {
  HIGH: "ALTA",
  MEDIUM: "MEDIA",
  LOW: "BAJA",
};

export function InvestmentVerdict({ verdict }: Props) {
  const cfg = ratingConfig[verdict.rating as keyof typeof ratingConfig] ?? ratingConfig.HOLD;

  return (
    <div className={`rounded-xl border p-4 mb-6 ${cfg.bg} ${cfg.border}`}>
      <div className="flex items-center gap-3 mb-2">
        <span className={`px-3 py-1 rounded-full text-sm font-bold tracking-wide ${cfg.badge}`}>
          {ratingLabel[verdict.rating] ?? verdict.rating}
        </span>
        <span className={`text-xs font-semibold uppercase tracking-widest ${cfg.text}`}>
          Convicción {convictionLabel[verdict.conviction] ?? verdict.conviction}
        </span>
      </div>
      <div className={`text-sm leading-relaxed prose prose-sm max-w-none prose-strong:text-current prose-p:my-0 ${cfg.text}`}>
        <ReactMarkdown>{verdict.rationale}</ReactMarkdown>
      </div>
    </div>
  );
}
