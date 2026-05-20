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

const convictionCopy: Record<VerdictRating, Record<VerdictConviction, string>> = {
  BUY: {
    HIGH: "Datos cuantitativos y cualitativos alineados. Tesis apta para posición core.",
    MEDIUM: "Tesis razonable con 1–2 factores en conflicto. Sizing satélite y revisar próximo earnings.",
    LOW: "Tesis dependiente de supuestos no verificables. Exposición mínima o esperar más data.",
  },
  HOLD: {
    HIGH: "Equilibrio claro entre catalizadores y riesgos. Mantener si ya hay posición; no añadir.",
    MEDIUM: "Señales mixtas que no justifican comprar ni vender. Mantener con monitoreo activo.",
    LOW: "Datos insuficientes para una recomendación direccional. Mantener tamaño actual.",
  },
  AVOID: {
    HIGH: "Riesgos materiales claramente identificados. Exit gradual si hay exposición.",
    MEDIUM: "Factores negativos dominan pero con incertidumbre. No iniciar; reducir si ya hay posición.",
    LOW: "Datos insuficientes o supuestos frágiles. Preferible evitar hasta tener mayor claridad.",
  },
};

export function InvestmentVerdict({ verdict }: Props) {
  const rating = (verdict.rating as VerdictRating) in ratingConfig ? (verdict.rating as VerdictRating) : "HOLD";
  const conviction = (verdict.conviction in convictionLabel ? verdict.conviction : "MEDIUM") as VerdictConviction;
  const cfg = ratingConfig[rating];
  const convictionText = convictionCopy[rating][conviction];

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
            Convicción · {convictionLabel[conviction]}
          </div>
          <div
            className="body-base"
            style={{
              marginTop: "var(--space-2)",
              color: "var(--ink-3, var(--ink-2))",
              fontSize: 13,
              lineHeight: 1.45,
              maxWidth: "28em",
            }}
          >
            {convictionText}
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
