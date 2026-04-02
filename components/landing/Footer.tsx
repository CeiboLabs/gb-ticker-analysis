"use client";

import { TickerSearch } from "@/components/TickerSearch";

interface Props {
  onSearch: (ticker: string) => void;
}

export function Footer({ onSearch }: Props) {
  return (
    <footer className="bg-[#F8F9FF] border-t-2 border-[#C9A84C]/30 pt-16 pb-10 px-6">
      <div className="max-w-3xl mx-auto text-center">
        {/* CTA */}
        <p className="text-2xl sm:text-3xl font-bold text-[#03065E] mb-3">
          Comenzá tu Análisis
        </p>
        <p className="text-sm text-[#03065E]/45 mb-8">
          Buscá cualquier empresa listada en EE.UU. y recibí un reporte profesional en segundos.
        </p>

        <div className="max-w-md mx-auto mb-16">
          <TickerSearch variant="footer" onSubmit={onSearch} />
        </div>

        {/* Logo and attributions */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/logo-bengochea.svg"
          alt="Gastón Bengochea"
          className="h-6 w-auto mx-auto mb-6 opacity-30"
        />

        <p className="text-xs text-[#03065E]/25 mb-2">
          Datos de Yahoo Finance · SEC EDGAR · Análisis por OpenAI GPT-4o
        </p>
        <p className="text-xs text-[#03065E]/20">
          © {new Date().getFullYear()} Gastón Bengochea — Corredor de Bolsa. Todos los derechos reservados.
        </p>
        <p className="text-xs text-[#03065E]/20 mt-2 max-w-md mx-auto">
          Este reporte es informativo y no constituye asesoramiento financiero. Consultá a tu asesor antes de tomar decisiones de inversión.
        </p>
      </div>
    </footer>
  );
}
