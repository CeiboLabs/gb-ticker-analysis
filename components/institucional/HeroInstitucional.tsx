"use client";

import Link from "next/link";

const LEDGER = [
  { cap: "Fundada", value: "1967", mono: true },
  { cap: "Trayectoria", value: "57 + años", mono: false },
  { cap: "Regulada por", value: "BCU", mono: false },
  { cap: "Plaza", value: "Montevideo · BVM", mono: false },
];

export function HeroInstitucional() {
  return (
    <header className="section-navy" style={{ position: "relative", overflow: "hidden" }}>
      {/* Halo dorado discreto */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(60% 80% at 85% 10%, rgba(201,168,76,0.10), transparent 60%), linear-gradient(180deg, rgba(255,255,255,0.0), rgba(0,0,0,0.15))",
          pointerEvents: "none",
        }}
      />

      <div
        className="wrap"
        style={{
          paddingTop: "calc(var(--nav-h) + var(--space-7))",
          paddingBottom: "var(--space-8)",
          position: "relative",
          zIndex: 1,
        }}
      >
        {/* Meta-row */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "baseline",
            borderBottom: "1px solid rgba(255,255,255,0.18)",
            paddingBottom: "var(--space-3)",
            marginBottom: "var(--space-7)",
            color: "rgba(255,255,255,0.7)",
            gap: 16,
            flexWrap: "wrap",
          }}
        >
          <span className="cap" style={{ color: "rgba(255,255,255,0.55)" }}>
            Sociedad de Bolsa · Montevideo
          </span>
          <span className="cap mono" style={{ color: "rgba(255,255,255,0.55)" }}>
            EST. 1967
          </span>
        </div>

        {/* Headline serif */}
        <h1
          className="serif fade-up"
          style={{
            fontWeight: 300,
            fontSize: "clamp(48px, 8vw, 112px)",
            lineHeight: 0.98,
            letterSpacing: "-0.025em",
            margin: 0,
            color: "var(--ivory)",
            maxWidth: "16ch",
          }}
        >
          Acceso a los mercados del mundo,{" "}
          <em style={{ fontStyle: "italic", color: "var(--gold-soft)", fontWeight: 300 }}>
            desde Uruguay.
          </em>
        </h1>

        {/* Lede */}
        <p
          className="lede fade-up delay-1"
          style={{
            color: "rgba(255,255,255,0.85)",
            maxWidth: "38em",
            margin: "var(--space-5) 0 0",
          }}
        >
          Una casa de bolsa uruguaya con cincuenta y siete años de oficio. Acompañamos a inversores con cuentas segregadas a nombre del cliente, asesoramiento de la casa y la mirada de quienes vienen leyendo los mercados desde 1967.
        </p>

        {/* CTAs */}
        <div
          className="fade-up delay-2"
          style={{ display: "flex", gap: 12, marginTop: "var(--space-6)", flexWrap: "wrap" }}
        >
          <Link href="/contacto" className="btn btn-on-navy-primary">
            Agendá una reunión <span className="arrow" />
          </Link>
          <Link href="/analisis" className="btn btn-on-navy-secondary">
            Analizar una acción
          </Link>
        </div>

        {/* Ledger */}
        <div
          className="hero-ledger fade-up delay-3"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            gap: "var(--space-5)",
            marginTop: "var(--space-7)",
            paddingTop: "var(--space-5)",
            borderTop: "1px solid rgba(255,255,255,0.18)",
          }}
        >
          {LEDGER.map((cell) => (
            <div key={cell.cap}>
              <div className="cap" style={{ color: "rgba(255,255,255,0.5)" }}>
                {cell.cap}
              </div>
              <div
                className={cell.mono ? "mono hero-ledger-value" : "serif hero-ledger-value"}
                style={{
                  fontWeight: 400,
                  fontSize: cell.mono ? 26 : 32,
                  marginTop: "var(--space-2)",
                  color: "var(--ivory)",
                  letterSpacing: cell.mono ? 0 : "-0.01em",
                }}
              >
                {cell.value}
              </div>
            </div>
          ))}
        </div>
      </div>

      <style>{`
        @media (max-width: 900px) {
          .hero-ledger { grid-template-columns: repeat(2, 1fr) !important; gap: var(--space-4) !important; }
          .hero-ledger-value { font-size: 22px !important; }
        }
        @media (max-width: 420px) {
          .hero-ledger { grid-template-columns: 1fr 1fr !important; gap: var(--space-3) !important; }
          .hero-ledger-value { font-size: 18px !important; }
        }
      `}</style>
    </header>
  );
}
