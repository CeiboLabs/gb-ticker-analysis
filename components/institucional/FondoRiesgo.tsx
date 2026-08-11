"use client";

import { css } from "@/lib/css";

// Indicador de riesgo estilo SRI (escala 1–7), igual que la ficha de un fondo
// europeo.
//
// ⚠️ NO MONTAR EN NINGUNA PÁGINA. Hoy no se renderiza en ningún lado y así tiene
// que seguir: el SRI es un indicador del régimen europeo (KIID/PRIIPs) que este
// Fondo NO tiene. No surge del Reglamento aprobado por el BCU ni de ninguna
// norma uruguaya, y el "4 de 7" es una estimación nuestra: publicar una escala
// regulatoria inventada es peor que no publicar ninguna. Lo que sí dice el
// Reglamento es que el Fondo está dirigido a inversores de perfil MODERADO
// (cláusula 3.1) y que no cuenta con calificación de riesgo — eso ya está en la
// página, en texto.

const NIVEL = 4; // ⚠️ estimación nuestra, sin respaldo normativo. Ver arriba.

export function FondoRiesgo() {
  const niveles = [1, 2, 3, 4, 5, 6, 7];
  return (
    <div className="riesgo">
      <div className="riesgo-scale" role="img" aria-label={`Indicador de riesgo: ${NIVEL} de 7`}>
        {niveles.map((n) => (
          <span key={n} className="riesgo-step" data-on={n === NIVEL ? "1" : "0"}>{n}</span>
        ))}
      </div>
      <div className="riesgo-legend">
        <span>Menor riesgo · menor rendimiento potencial</span>
        <span>Mayor riesgo · mayor rendimiento potencial</span>
      </div>
      <p className="riesgo-note">
        El indicador se ubica en <strong>{NIVEL} de 7</strong>: un perfil de riesgo moderado, coherente con una
        cartera balanceada entre renta variable y renta fija. Refleja la relación entre el riesgo asumido y el
        rendimiento potencial del fondo.
      </p>

      <style>{css`
        .riesgo-scale { display: grid; grid-template-columns: repeat(7, 1fr); gap: 8px; }
        .riesgo-step {
          height: 56px; display: flex; align-items: center; justify-content: center;
          border-radius: 10px; font-size: 18px; font-weight: 500;
          font-variant-numeric: tabular-nums;
          background: linear-gradient(180deg, #f7f8fc 0%, #eef0f7 100%);
          border: 1px solid var(--site-border);
          color: var(--site-ink-3);
          transition: transform 200ms ease;
        }
        .riesgo-step[data-on="1"] {
          background: linear-gradient(180deg, var(--navy-700) 0%, var(--navy) 100%);
          border-color: var(--navy);
          color: #fff;
          font-weight: 700;
          transform: translateY(-4px) scale(1.06);
          box-shadow: 0 12px 24px -10px rgba(15,34,73,0.5);
        }
        .riesgo-legend {
          display: flex; justify-content: space-between; gap: 16px; margin-top: 12px;
          font-size: 12px; color: var(--site-ink-3);
        }
        .riesgo-legend span:last-child { text-align: right; }
        .riesgo-note { margin-top: 20px; font-size: 14px; line-height: 1.6; color: var(--site-ink-2); max-width: 44em; }
        @media (max-width: 560px) {
          .riesgo-step { height: 44px; font-size: 15px; }
          .riesgo-legend { flex-direction: column; gap: 4px; }
          .riesgo-legend span:last-child { text-align: left; }
        }
      `}</style>
    </div>
  );
}
