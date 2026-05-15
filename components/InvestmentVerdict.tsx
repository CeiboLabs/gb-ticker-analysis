"use client";

import ReactMarkdown from "react-markdown";
import type { Verdict, VerdictRating, VerdictConviction } from "@/types/Report";

interface Props {
  verdict: Verdict;
}

const ratingConfig: Record<VerdictRating, { color: string; label: string }> = {
  BUY: { color: "var(--pos)", label: "buy." },
  HOLD: { color: "var(--neu)", label: "hold." },
  AVOID: { color: "var(--neg)", label: "avoid." },
};

const ratingHeader: Record<VerdictRating, string> = {
  BUY: "Comprar",
  HOLD: "Mantener",
  AVOID: "Evitar",
};

const convictionLabel: Record<VerdictConviction, string> = {
  HIGH: "Alta",
  MEDIUM: "Media",
  LOW: "Baja",
};

export function InvestmentVerdict({ verdict }: Props) {
  const cfg = ratingConfig[verdict.rating as VerdictRating] ?? ratingConfig.HOLD;

  return (
    <div
      style={{
        borderTop: "1px solid var(--ink)",
        borderBottom: "1px solid var(--rule)",
        padding: "var(--space-5) 0",
        marginBottom: "var(--space-5)",
      }}
    >
      <div className="cap-gold" style={{ marginBottom: "var(--space-2)" }}>Veredicto</div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 260px) 1fr",
          gap: "var(--space-6)",
          alignItems: "start",
        }}
        className="verdict-grid"
      >
        <div>
          <div
            className="serif"
            style={{
              fontWeight: 400,
              fontSize: 56,
              lineHeight: 1,
              color: "var(--ink)",
              letterSpacing: "-0.025em",
            }}
          >
            {ratingHeader[verdict.rating as VerdictRating] ?? verdict.rating}{" "}
            <span className="serif-i" style={{ color: cfg.color, fontStyle: "italic", fontWeight: 300 }}>
              {cfg.label}
            </span>
          </div>
          <div className="cap" style={{ marginTop: "var(--space-3)", color: "var(--ink-2)" }}>
            Convicción · {convictionLabel[verdict.conviction] ?? verdict.conviction}
          </div>
        </div>
        <div
          className="body-base prose prose-sm"
          style={{
            maxWidth: "44em",
            color: "var(--ink-2)",
          }}
        >
          <ReactMarkdown>{verdict.rationale}</ReactMarkdown>
        </div>
      </div>

      <style>{`
        @media (max-width: 760px) {
          .verdict-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}
