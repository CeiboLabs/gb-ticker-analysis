/* ──────────────────────────────────────────────────────────────
   Íconos de línea institucionales — una sola fuente de verdad.
   viewBox 24, stroke currentColor (el color lo define el contenedor:
   .feat-icon / .list-icon en globals.css, gold-deep / gold-soft).
   ────────────────────────────────────────────────────────────── */

type IconProps = { className?: string };

const base = {
  width: 24,
  height: 24,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.4,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true as const,
};

export const ArrowRight = ({ className }: IconProps) => (
  <svg className={className} {...base} strokeWidth={1.5}>
    <path d="M5 12h14M13 6l6 6-6 6" />
  </svg>
);

/* ── Marca / pilares ── */
export const Columns = ({ className }: IconProps) => (
  <svg className={className} {...base}>
    <path d="M3 9l9-5 9 5" />
    <path d="M5 9v9M9.7 9v9M14.3 9v9M19 9v9" />
    <path d="M3 21h18" />
  </svg>
);
export const Globe = ({ className }: IconProps) => (
  <svg className={className} {...base}>
    <circle cx="12" cy="12" r="9" />
    <path d="M3 12h18" />
    <path d="M12 3c2.6 2.7 2.6 15.3 0 18M12 3c-2.6 2.7-2.6 15.3 0 18" />
  </svg>
);
export const Scales = ({ className }: IconProps) => (
  <svg className={className} {...base}>
    <path d="M12 4v17M8 21h8" />
    <path d="M5 7h14" />
    <path d="M5 7l-2.6 5.5h5.2z" />
    <path d="M19 7l-2.6 5.5h5.2z" />
  </svg>
);
export const Lock = ({ className }: IconProps) => (
  <svg className={className} {...base}>
    <rect x="4" y="10" width="16" height="11" rx="2" />
    <path d="M8 10V7a4 4 0 0 1 8 0v3" />
  </svg>
);
export const Waveform = ({ className }: IconProps) => (
  <svg className={className} {...base}>
    <path d="M3 10v4M7.5 6.5v11M12 3.5v17M16.5 6.5v11M21 10v4" />
  </svg>
);
export const Compass = ({ className }: IconProps) => (
  <svg className={className} {...base}>
    <circle cx="12" cy="12" r="9" />
    <path d="M16 8l-2.5 5.5L8 16l2.5-5.5z" />
  </svg>
);
export const Handshake = ({ className }: IconProps) => (
  <svg className={className} {...base}>
    <path d="M12 7l2-1.6a2 2 0 0 1 2.4 0L21 9" />
    <path d="M3 9l3.6-2.6a2 2 0 0 1 2.4 0L12 8.5" />
    <path d="M3 9v6l4 3 2-1.6" />
    <path d="M21 9v6l-5 3-3-2.4-2.5-2" />
    <path d="M9 12l2 1.6" />
  </svg>
);
export const Users = ({ className }: IconProps) => (
  <svg className={className} {...base}>
    <circle cx="9" cy="8" r="3.2" />
    <path d="M3.5 20a5.5 5.5 0 0 1 11 0" />
    <path d="M16 5.2a3.2 3.2 0 0 1 0 6" />
    <path d="M17.5 14.6A5.5 5.5 0 0 1 20.5 19.5" />
  </svg>
);

/* ── Contacto ── */
export const Phone = ({ className }: IconProps) => (
  <svg className={className} {...base}>
    <path d="M4 5c0-1 .8-2 2-2h2l1.5 4-2 1.5a13 13 0 0 0 6 6l1.5-2 4 1.5v2c0 1.1-.9 2-2 2A16 16 0 0 1 4 5z" />
  </svg>
);
export const Mail = ({ className }: IconProps) => (
  <svg className={className} {...base}>
    <rect x="3" y="5" width="18" height="14" rx="2" />
    <path d="M3.5 6.5L12 13l8.5-6.5" />
  </svg>
);
export const Message = ({ className }: IconProps) => (
  <svg className={className} {...base}>
    <path d="M4 5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H9l-5 4z" />
    <path d="M8 7.5h8M8 11h5" />
  </svg>
);
export const Pin = ({ className }: IconProps) => (
  <svg className={className} {...base}>
    <path d="M12 21s7-6.3 7-11a7 7 0 0 0-14 0c0 4.7 7 11 7 11z" />
    <circle cx="12" cy="10" r="2.6" />
  </svg>
);
export const Clock = ({ className }: IconProps) => (
  <svg className={className} {...base}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3.5 2" />
  </svg>
);
export const Calendar = ({ className }: IconProps) => (
  <svg className={className} {...base}>
    <rect x="3.5" y="5" width="17" height="16" rx="2" />
    <path d="M3.5 9.5h17M8 3v4M16 3v4" />
  </svg>
);

/* ── Análisis (herramienta) ── */
export const Verdict = ({ className }: IconProps) => (
  <svg className={className} {...base}>
    <circle cx="12" cy="12" r="9" />
    <path d="M8 12.2l2.6 2.6L16 9.4" />
  </svg>
);
export const BarChart = ({ className }: IconProps) => (
  <svg className={className} {...base}>
    <path d="M3 21h18" />
    <path d="M6 21V11M11 21V5M16 21v-7M21 21V8" />
  </svg>
);
export const LineChart = ({ className }: IconProps) => (
  <svg className={className} {...base}>
    <path d="M3 21V4M3 21h18" />
    <path d="M6 15l4-5 3 3 5-7" />
  </svg>
);
export const Flow = ({ className }: IconProps) => (
  <svg className={className} {...base}>
    <circle cx="5.5" cy="12" r="2.2" />
    <circle cx="18.5" cy="6.5" r="2.2" />
    <circle cx="18.5" cy="17.5" r="2.2" />
    <path d="M7.7 12h4M11.7 12l4.6-4.6M11.7 12l4.6 4.6" />
  </svg>
);
export const Poll = ({ className }: IconProps) => (
  <svg className={className} {...base}>
    <path d="M4 4v16h16" />
    <rect x="7" y="13" width="3" height="4" />
    <rect x="12" y="9" width="3" height="8" />
    <rect x="17" y="6" width="3" height="11" />
  </svg>
);
export const FileDown = ({ className }: IconProps) => (
  <svg className={className} {...base}>
    <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
    <path d="M14 3v5h5" />
    <path d="M12 11v6M9.5 14.5L12 17l2.5-2.5" />
  </svg>
);

/* ── Servicios (instrumentos) ── */
export const Certificate = ({ className }: IconProps) => (
  <svg className={className} {...base}>
    <rect x="4" y="4" width="16" height="12" rx="2" />
    <path d="M7.5 8h9M7.5 11h5" />
    <circle cx="9" cy="18.5" r="2.2" />
    <path d="M7.6 20l-1 3 2.4-1.4L11.4 23l-1-3" />
  </svg>
);
export const Shield = ({ className }: IconProps) => (
  <svg className={className} {...base}>
    <path d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6z" />
  </svg>
);
export const ShieldCheck = ({ className }: IconProps) => (
  <svg className={className} {...base}>
    <path d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6z" />
    <path d="M9 11.5l2 2 4-4.2" />
  </svg>
);
export const Layers = ({ className }: IconProps) => (
  <svg className={className} {...base}>
    <path d="M12 3l9 5-9 5-9-5z" />
    <path d="M3 13l9 5 9-5" />
  </svg>
);
export const Building = ({ className }: IconProps) => (
  <svg className={className} {...base}>
    <path d="M5 21V5a2 2 0 0 1 2-2h7a2 2 0 0 1 2 2v16" />
    <path d="M16 9h3a2 2 0 0 1 2 2v10" />
    <path d="M3 21h18" />
    <path d="M8.5 7h3M8.5 11h3M8.5 15h3" />
  </svg>
);
export const TrendingUp = ({ className }: IconProps) => (
  <svg className={className} {...base}>
    <path d="M3 17l6-6 4 4 8-8" />
    <path d="M16 7h5v5" />
  </svg>
);

/* ── Calculadora (perfiles / conceptos) ── */
export const Scale = Scales;
export const Rocket = ({ className }: IconProps) => (
  <svg className={className} {...base}>
    <path d="M12 3c3 1.5 5 5 5 9l-3 3h-4l-3-3c0-4 2-7.5 5-9z" />
    <circle cx="12" cy="9" r="1.6" />
    <path d="M9 18l-2 3M15 18l2 3M12 18v3" />
  </svg>
);
