// Schemas Zod de las rutas del panel de administración (/api/admin/panel/*).
// Centralizados como lib/validators.ts: una sola fuente del contrato de cada
// endpoint. La validación de NEGOCIO del fondo (bandas, conflictos) NO vive
// acá: la hace lib/fondoIngest.ts (validateNav/validateBatch) — estos schemas
// sólo garantizan la FORMA del payload antes de pasarlo al validador puro.

import { z } from "zod";
import { PANEL_PERMS } from "@/lib/panelStore";
import { isRealDate } from "@/lib/fondoIngest";

// ── Primitivas compartidas ───────────────────────────────────────────────────

// Política de contraseñas: largo mínimo 12 (con pepper + PBKDF2 + lockout +
// TOTP obligatorio, el largo pesa más que los requisitos de símbolos, que
// sólo generan Password1! predecibles).
export const PasswordSchema = z
  .string()
  .min(12, "La contraseña necesita al menos 12 caracteres")
  .max(200, "Contraseña demasiado larga");

const EmailSchema = z
  .string()
  .trim()
  .email("Email inválido")
  .max(200)
  .transform((v) => v.toLowerCase());

const TotpCodeSchema = z.string().trim().regex(/^\d{6}$/, "El código son 6 dígitos");

const DiaSchema = z
  .string()
  .trim()
  .refine((v) => isRealDate(v), "Fecha inválida (se espera YYYY-MM-DD)");

// ── Auth ─────────────────────────────────────────────────────────────────────

export const LoginSchema = z.object({
  email: EmailSchema,
  password: z.string().min(1, "Falta la contraseña").max(200),
  totp: TotpCodeSchema.optional(),
});

export const SetupSchema = z.object({
  token: z.string().trim().min(1, "Falta el token de instalación").max(500),
  email: EmailSchema,
  nombre: z.string().trim().min(2, "Nombre muy corto").max(100),
  password: PasswordSchema,
});

export const PasswordChangeSchema = z.object({
  actual: z.string().min(1, "Falta la contraseña actual").max(200),
  nueva: PasswordSchema,
  totp: TotpCodeSchema.optional(),
});

export const TotpVerifySchema = z.object({
  code: TotpCodeSchema,
});

// ── Usuarios (solo rol admin) ────────────────────────────────────────────────

const RoleSchema = z.enum(["admin", "editor"]);
const PermsSchema = z.array(z.enum(PANEL_PERMS)).max(PANEL_PERMS.length).default([]);

export const UsuarioCreateSchema = z.object({
  email: EmailSchema,
  nombre: z.string().trim().min(2, "Nombre muy corto").max(100),
  role: RoleSchema,
  perms: PermsSchema,
  // Clave temporal: el empleado la cambia obligatoriamente en el primer login.
  tempPassword: PasswordSchema,
});

export const UsuarioPatchSchema = z
  .object({
    nombre: z.string().trim().min(2).max(100).optional(),
    role: RoleSchema.optional(),
    perms: z.array(z.enum(PANEL_PERMS)).max(PANEL_PERMS.length).optional(),
    status: z.enum(["active", "disabled"]).optional(),
  })
  .refine((v) => Object.values(v).some((x) => x !== undefined), { message: "Nada para actualizar" });

export const ResetPasswordSchema = z.object({
  tempPassword: PasswordSchema,
});

// ── Informes ─────────────────────────────────────────────────────────────────

// Id de video de YouTube (el embed arma la URL youtube-nocookie con esto).
const VideoIdSchema = z.string().trim().regex(/^[A-Za-z0-9_-]{6,20}$/, "Id de video de YouTube inválido");

// URL externa de PDF: sólo https y sólo el host histórico del cliente — el
// proxy de /informes la fetchea server-side, y sin allowlist sería un
// open-proxy hacia cualquier URL que alguien escriba en el panel.
export const PDF_URL_HOSTS = ["gbengochea.com.uy", "www.gbengochea.com.uy"] as const;
const PdfUrlSchema = z
  .string()
  .trim()
  .max(500)
  .refine((v) => {
    try {
      const u = new URL(v);
      return u.protocol === "https:" && (PDF_URL_HOSTS as readonly string[]).includes(u.hostname);
    } catch {
      return false;
    }
  }, "La URL debe ser https y del host gbengochea.com.uy (para PDFs nuevos, subí el archivo)");

export const InformeCreateSchema = z.object({
  fecha: DiaSchema,
  titulo: z.string().trim().min(3, "Título muy corto").max(200),
  categoria: z.enum(["Mensual", "Semanal"]),
  // La fecha en prosa se genera server-side (es-UY) si no viene.
  fechaTexto: z.string().trim().min(3).max(80).optional(),
  videoId: VideoIdSchema.optional(),
  pdfUrl: PdfUrlSchema.optional(),
});

// PATCH: null explícito = limpiar el campo (videoId/pdfUrl); ausente = no tocar.
export const InformePatchSchema = z
  .object({
    titulo: z.string().trim().min(3).max(200).optional(),
    fecha: DiaSchema.optional(),
    fechaTexto: z.string().trim().min(3).max(80).optional(),
    videoId: VideoIdSchema.nullable().optional(),
    pdfUrl: PdfUrlSchema.nullable().optional(),
    status: z.enum(["live", "hold"]).optional(),
  })
  .refine((v) => Object.values(v).some((x) => x !== undefined), { message: "Nada para actualizar" });

// ── Fondo ────────────────────────────────────────────────────────────────────

// Forma laxa a propósito: dia/nav/aum se pasan CRUDOS a validateNav
// (lib/fondoIngest), que es la única fuente de verdad de qué es publicable.
const NavValueSchema = z.union([z.number(), z.string().trim().min(1).max(40)]);

export const NavManualSchema = z.object({
  dia: z.string().trim().min(1).max(20),
  nav: NavValueSchema,
  aum: NavValueSchema.nullable().optional(),
  nota: z.string().trim().max(300).optional(),
});

export const BackfillSchema = z.object({
  // CSV pegado en el textarea: 'dia,nav[,aum[,nota]]' por línea, decimal con punto.
  csv: z.string().min(1, "Pegá el histórico").max(200_000, "El lote supera los 200 KB"),
  // El rango del lote pisa cierres ya publicados sólo con confirmación expresa.
  sobrescribir: z.boolean().optional().default(false),
});

export const OverrideSchema = z.object({
  dia: z.string().trim().min(1).max(20),
  nav: NavValueSchema,
  aum: NavValueSchema.nullable().optional(),
  motivo: z.string().trim().min(5, "El motivo es obligatorio (mínimo 5 caracteres)").max(300),
});

export const HoldingsSchema = z
  .object({
    asOf: DiaSchema,
    note: z.string().trim().max(300).optional(),
    items: z
      .array(
        z.object({
          name: z.string().trim().min(2, "Nombre muy corto").max(120),
          short: z.string().trim().max(24).optional(),
          assetClass: z.enum(["RV", "RF", "Otros"]),
          weightBps: z.number().int("Los pesos van en basis points enteros").min(1).max(10_000),
        }),
      )
      .min(1, "El snapshot necesita al menos una línea")
      .max(50),
  })
  .refine(
    (v) => {
      const sum = v.items.reduce((acc, it) => acc + it.weightBps, 0);
      return Math.abs(sum - 10_000) <= 100;
    },
    { message: "Los pesos deben sumar ~100% (10000 bps ± 100)" },
  )
  .refine((v) => new Set(v.items.map((it) => it.name.toLowerCase())).size === v.items.length, {
    message: "Hay nombres de tenencia repetidos",
  });

// ── Documentos del fondo ─────────────────────────────────────────────────────

export const FONDO_DOC_TIPOS = ["ficha-tecnica", "datos-fundamentales", "reglamento", "informe-cartera"] as const;
export type FondoDocTipo = (typeof FONDO_DOC_TIPOS)[number];

export function isFondoDocTipo(t: string): t is FondoDocTipo {
  return (FONDO_DOC_TIPOS as readonly string[]).includes(t);
}

export const DocumentoPatchSchema = z
  .object({
    titulo: z.string().trim().min(3).max(120).optional(),
    descripcion: z.string().trim().max(300).nullable().optional(),
    status: z.enum(["live", "hold"]).optional(),
  })
  .refine((v) => Object.values(v).some((x) => x !== undefined), { message: "Nada para actualizar" });

// ── Flags ────────────────────────────────────────────────────────────────────

export const FlagPatchSchema = z.object({
  enabled: z.boolean(),
});

// ── Uploads ──────────────────────────────────────────────────────────────────

export const MAX_PDF_BYTES = 15 * 1024 * 1024; // 15 MB
