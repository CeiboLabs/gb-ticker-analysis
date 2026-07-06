"use client";

// Primitivas de UI del panel de administración. Herramienta interna que HABLA
// EL MISMO IDIOMA que el sitio público: navy como estructura, oro racionado,
// datos sobre hairlines (nunca cards con sombra), Arial liviano en el chrome y
// mono tabular en todo número. Las clases .adm-* viven en app/globals.css y se
// usan siempre dentro de un ancestro .site. Acá también vive panelFetch, el
// único camino de los componentes del panel hacia /api/admin/panel/* (cookie
// same-origin, sin headers de token).

import { type ReactNode } from "react";

export type PanelResponse<T = Record<string, unknown>> = {
  status: number;
  data: (T & { error?: string; detalle?: string; next?: string | null }) | null;
};

/**
 * fetch same-origin del panel. Ante 401 (sesión muerta) redirige al login —
 * salvo que se pida lo contrario (el propio login usa esto).
 */
export async function panelFetch<T = Record<string, unknown>>(
  path: string,
  init?: RequestInit & { redirectOn401?: boolean },
): Promise<PanelResponse<T>> {
  const { redirectOn401 = true, ...rest } = init ?? {};
  // Con FormData el browser arma el Content-Type (boundary incluido): forzar
  // application/json rompería el multipart de los uploads.
  const isForm = rest.body instanceof FormData;
  let res: Response;
  try {
    res = await fetch(path, {
      ...rest,
      headers: { ...(isForm ? {} : { "Content-Type": "application/json" }), ...(rest.headers ?? {}) },
    });
  } catch {
    return { status: 0, data: null };
  }
  if (res.status === 401 && redirectOn401) {
    window.location.href = "/admin/login";
    return { status: 401, data: null };
  }
  let data: PanelResponse<T>["data"] = null;
  try {
    data = (await res.json()) as PanelResponse<T>["data"];
  } catch {
    // respuesta sin body JSON (raro) — se maneja por status
  }
  return { status: res.status, data };
}

/** Mensaje humano para los códigos de error del API del panel. */
export function errorMessage(r: PanelResponse<Record<string, unknown>>): string {
  const code = r.data?.error;
  if (r.status === 0) return "No se pudo conectar. ¿Se cayó el preview?";
  switch (code) {
    case "credenciales":
      return "Email, contraseña o código incorrectos.";
    case "codigo":
      return "Código incorrecto. Probá con el siguiente que muestre la app.";
    case "rate_limited":
      return "Demasiados intentos. Esperá un rato y volvé a probar.";
    case "sin_bindings":
      return "El panel necesita la D1 y el pepper: en local corré `npm run pages:preview` (no `next dev`).";
    case "forbidden":
      return "Pedido rechazado (origen inválido).";
    case "sin_permiso":
      return "No tenés permiso para esta sección.";
    case "setup_pendiente":
      return "Primero completá la configuración de acceso.";
    case "ya_configurado":
      return "El panel ya tiene un administrador. Ingresá por el login.";
    case "ya_enrolado":
      return "Esta cuenta ya tiene un segundo factor configurado.";
    case "password_primero":
      return "Primero cambiá la contraseña temporal.";
    case "pending_vencido":
      return "El código QR venció. Generá uno nuevo.";
    case "misma_password":
      return "La contraseña nueva no puede ser igual a la actual.";
    case "config":
      return "Error de configuración del panel — avisá al administrador (ver RUNBOOK).";
    case "bad_request":
      return typeof r.data?.detalle === "string" ? r.data.detalle : "Datos inválidos.";
    default:
      return typeof r.data?.detalle === "string" ? r.data.detalle : `Error inesperado (${r.status}).`;
  }
}

// ── Primitivas visuales ──────────────────────────────────────────────────────

/** Tarjeta: superficie plana con hairline, cero sombra (los datos no van en cards). */
export function Card({
  title,
  children,
  actions,
  muted,
}: {
  title?: string;
  children: ReactNode;
  actions?: ReactNode;
  muted?: boolean;
}) {
  return (
    <section className={`adm-card${muted ? " adm-card-muted" : ""}`}>
      {(title || actions) && (
        <header className="adm-card-hd">
          {title ? <h2 className="t">{title}</h2> : <span />}
          {actions}
        </header>
      )}
      <div className="adm-card-bd">{children}</div>
    </section>
  );
}

/** Cabecera de sección: eyebrow callado + título Arial liviano + dek, con masthead inferior. */
export function PageHeader({
  eyebrow,
  eyebrowGold,
  title,
  dek,
}: {
  eyebrow?: string;
  eyebrowGold?: boolean;
  title: string;
  dek?: ReactNode;
}) {
  return (
    <header className="adm-head">
      {eyebrow && <p className={`adm-eyebrow${eyebrowGold ? " gold" : ""}`}>{eyebrow}</p>}
      <h1 className="adm-title">{title}</h1>
      {dek && <p className="adm-dek">{dek}</p>}
    </header>
  );
}

export function Btn({
  children,
  kind = "primary",
  sm,
  disabled,
  onClick,
  type = "button",
}: {
  children: ReactNode;
  kind?: "primary" | "ghost" | "danger";
  sm?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  type?: "button" | "submit";
}) {
  return (
    <button type={type} disabled={disabled} onClick={onClick} className={`adm-btn adm-btn-${kind}${sm ? " adm-btn-sm" : ""}`}>
      {children}
    </button>
  );
}

export function Label({ children, htmlFor }: { children: ReactNode; htmlFor?: string }) {
  return (
    <label htmlFor={htmlFor} className="adm-label">
      {children}
    </label>
  );
}

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  const { className, ...rest } = props;
  return <input {...rest} className={`adm-input${className ? ` ${className}` : ""}`} />;
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  const { className, ...rest } = props;
  return <select {...rest} className={`adm-select${className ? ` ${className}` : ""}`} />;
}

export function Notice({ kind, children }: { kind: "error" | "ok" | "info"; children: ReactNode }) {
  return <p className={`adm-notice ${kind}`}>{children}</p>;
}

/** Interruptor on/off. Navy = on (control, no señal financiera — de ahí, nunca verde). */
export function Toggle({
  checked,
  onChange,
  disabled,
  label,
}: {
  checked: boolean;
  onChange: () => void;
  disabled?: boolean;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={onChange}
      className="adm-toggle"
    >
      <span />
    </button>
  );
}

// Tonos de badge: los nombres nuevos (pos/neg/neu/gold/neutral) y un alias de los
// viejos (green/red/amber/slate) para no romper llamadas existentes. El ámbar de
// semáforo NO existe en esta marca: "pendiente/oculto" cae en pizarra (neu).
type BadgeTone = "neutral" | "pos" | "neg" | "neu" | "gold" | "slate" | "green" | "amber" | "red";
const BADGE_ALIAS: Record<BadgeTone, "neutral" | "pos" | "neg" | "neu" | "gold"> = {
  neutral: "neutral", pos: "pos", neg: "neg", neu: "neu", gold: "gold",
  slate: "neutral", green: "pos", red: "neg", amber: "neu",
};

export function Badge({ children, tone = "neutral" }: { children: ReactNode; tone?: BadgeTone }) {
  return <span className={`adm-badge ${BADGE_ALIAS[tone]}`}>{children}</span>;
}

// ── Estadísticas de un vistazo (grilla hairline, valores en mono tabular) ──────

export function StatGrid({ children }: { children: ReactNode }) {
  return <div className="adm-stats">{children}</div>;
}

export function Stat({ k, v, s, tone }: { k: string; v: ReactNode; s?: ReactNode; tone?: "pos" | "neg" }) {
  return (
    <div className="adm-stat">
      <span className="k">{k}</span>
      <span className="v">{v}</span>
      {s != null && <span className={`s${tone ? ` ${tone}` : ""}`}>{s}</span>}
    </div>
  );
}

export { fmtTs } from "@/components/admin/format";
