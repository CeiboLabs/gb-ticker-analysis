import { z } from "zod";

const TICKER_RE = /^[A-Z0-9.\-]+$/;
const TICKER_MAX = 10;

// Single source of truth for ticker validation. Use this from any route or
// helper that takes a user-supplied symbol — keeps the allowed alphabet from
// drifting between endpoints.
export function isValidTicker(s: unknown): s is string {
  return typeof s === "string" && s.length >= 1 && s.length <= TICKER_MAX && TICKER_RE.test(s.toUpperCase());
}

// Returns the normalized (uppercased) ticker, or null if it doesn't validate.
export function normalizeTicker(s: unknown): string | null {
  if (typeof s !== "string") return null;
  const t = s.trim().toUpperCase();
  return t.length >= 1 && t.length <= TICKER_MAX && TICKER_RE.test(t) ? t : null;
}

export const AnalyzeRequestSchema = z.object({
  ticker: z
    .string()
    .min(1)
    .max(TICKER_MAX)
    .regex(/^[A-Z0-9.\-]+$/i, "Invalid ticker symbol")
    .transform((v) => v.toUpperCase()),
  refresh: z.boolean().optional().default(false),
});

export type AnalyzeRequest = z.infer<typeof AnalyzeRequestSchema>;

// Contact form (sitio institucional). Motivos cerrados a la lista del form —
// cualquier otro valor es un cliente armado a mano.
export const CONTACT_MOTIVOS = [
  "cuenta-personal",
  "cuenta-empresa",
  "asesoria",
  "productos",
  "otro",
] as const;

export const ContactRequestSchema = z.object({
  nombre: z.string().trim().min(2, "Nombre muy corto").max(100),
  apellido: z.string().trim().min(2, "Apellido muy corto").max(100),
  email: z.string().trim().email("Email inválido").max(200),
  telefono: z.string().trim().max(40).optional().default(""),
  motivo: z.enum(CONTACT_MOTIVOS),
  mensaje: z.string().trim().min(10, "Contanos un poco más").max(2000),
});

export type ContactRequest = z.infer<typeof ContactRequestSchema>;

