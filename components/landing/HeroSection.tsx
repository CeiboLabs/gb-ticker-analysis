"use client";

import { useState, useEffect } from "react";
import { TickerSearch } from "@/components/TickerSearch";

interface Props {
  onSearch: (ticker: string) => void;
}

export function HeroSection({ onSearch }: Props) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // Trigger entrance animations after mount
    requestAnimationFrame(() => setMounted(true));
  }, []);

  return (
    <section className="min-h-screen flex flex-col items-center justify-center bg-[#03065E] text-white px-6 py-20 relative overflow-hidden">
      {/* Subtle grid background */}
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: "linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)",
          backgroundSize: "48px 48px",
        }}
      />

      {/* Logo */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/logo-bengochea.svg"
        alt="Gastón Bengochea"
        className="h-8 sm:h-10 w-auto mb-12 relative"
        style={{
          filter: "brightness(0) invert(1)",
          opacity: mounted ? 1 : 0,
          transform: mounted ? "translateY(0)" : "translateY(-16px)",
          transition: "all 0.8s ease-out 0.1s",
        }}
      />

      {/* Headline */}
      <h1
        className="text-3xl md:text-4xl lg:text-5xl font-bold text-center max-w-2xl leading-tight mb-5 relative"
        style={{
          opacity: mounted ? 1 : 0,
          transform: mounted ? "translateY(0)" : "translateY(20px)",
          transition: "all 0.8s ease-out 0.3s",
        }}
      >
        Reportes de Acciones con Calidad Profesional
      </h1>

      {/* Subheadline */}
      <p
        className="text-base sm:text-lg text-white/60 text-center max-w-xl mb-12 relative pointer-events-none"
        style={{
          opacity: mounted ? 1 : 0,
          transform: mounted ? "translateY(0)" : "translateY(16px)",
          transition: "all 0.8s ease-out 0.5s",
        }}
      >
        Reportes de investigación de renta variable con calidad profesional para acciones listadas en EE.UU. Datos reales. Veredictos claros. En segundos.
      </p>

      {/* Search bar */}
      <div
        className="w-full max-w-md relative"
        style={{
          opacity: mounted ? 1 : 0,
          transform: mounted ? "translateY(0)" : "translateY(16px)",
          transition: "all 0.8s ease-out 0.7s",
        }}
      >
        <TickerSearch variant="hero" onSubmit={onSearch} />
      </div>

      {/* Example tickers */}
      <p
        className="mt-4 text-xs text-white/30 tracking-wide relative pointer-events-none"
        style={{
          opacity: mounted ? 1 : 0,
          transition: "opacity 0.8s ease-out 0.9s",
        }}
      >
        Probá con Apple, Tesla, MELI o cualquier empresa listada en EE.UU.
      </p>

      {/* Scroll indicator */}
      <div
        className="absolute bottom-8 flex flex-col items-center text-white/20 animate-bounce"
        style={{
          opacity: mounted ? 1 : 0,
          transition: "opacity 1s ease-out 1.2s",
        }}
      >
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M5 8l5 5 5-5" />
        </svg>
      </div>
    </section>
  );
}
