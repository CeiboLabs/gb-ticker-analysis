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
//
// 'cuenta-analisis' NO está en el <select> de /contacto: lo emite únicamente el
// CTA de apertura al pie del informe de /analisis. Vale la pena distinguirlo de
// 'cuenta-personal' porque es el pedido que mide si la herramienta convierte, y
// porque llega con `contexto` (la acción que la persona estaba leyendo) — la
// mesa levanta el teléfono sabiendo de qué hablar.
export const CONTACT_MOTIVOS = [
  "cuenta-personal",
  "cuenta-empresa",
  "cuenta-analisis",
  "asesoria",
  "productos",
  "otro",
] as const;

export const ContactRequestSchema = z
  .object({
    nombre: z.string().trim().min(2, "Nombre muy corto").max(100),
    apellido: z.string().trim().min(2, "Apellido muy corto").max(100),
    // Minúsculas como en NewsletterRequestSchema: es la clave con la que el
    // panel de leads cruza el pedido de contacto con el suscriptor y su
    // actividad. Sin normalizar, "Juan@X.com" y "juan@x.com" son dos personas
    // distintas y el lead más caliente que tenemos aparece como frío.
    email: z.string().trim().email("Email inválido").max(200).transform((v) => v.toLowerCase()),
    telefono: z.string().trim().max(40).optional().default(""),
    motivo: z.enum(CONTACT_MOTIVOS),
    // Sin mínimo en el tipo base: el refine de abajo lo exige según el motivo.
    mensaje: z.string().trim().max(2000).optional().default(""),
    // De dónde salió el pedido — hoy el ticker del informe. Lo pone el cliente y
    // se muestra tal cual en el mail a la mesa, así que va acotado y con el
    // mismo alfabeto que AnalyzeRequestSchema: nada de texto libre viajando a
    // una bandeja de entrada.
    contexto: z
      .string()
      .trim()
      .max(12)
      .regex(/^[A-Z0-9.\-]*$/i, "Contexto inválido")
      .optional()
      .default(""),
  })
  .superRefine((v, ctx) => {
    // El formulario de /contacto necesita que la persona cuente qué quiere: sin
    // eso el mensaje no le sirve a nadie. El CTA del informe pide lo mínimo
    // —nombre, correo, teléfono— porque cada campo de más es gente que no lo
    // manda, y el contexto que importa (qué acción miraba) ya viaja aparte.
    if (v.motivo !== "cuenta-analisis" && v.mensaje.length < 10) {
      ctx.addIssue({ code: "custom", path: ["mensaje"], message: "Contanos un poco más" });
    }
  });

export type ContactRequest = z.infer<typeof ContactRequestSchema>;

// Newsletter (alta a la lista de la casa). El texto de consentimiento vive en
// lib/newsletterConsent.ts (módulo sin zod, compartido con el componente cliente).
// consent es un opt-in EXPRESO: sólo se acepta true (la casilla marcada). source
// se limita a un slug corto de la página de origen — cualquier otra cosa es un
// cliente armado a mano.
export const NewsletterRequestSchema = z.object({
  // Normalizamos a minúsculas con .transform (mismo idiom que AnalyzeRequestSchema
  // con .toUpperCase) para que el índice único de email dedupe sin importar cómo
  // lo tipeó la persona.
  email: z.string().trim().email("Email inválido").max(200).transform((v) => v.toLowerCase()),
  // Opt-in EXPRESO: sólo pasa true (la casilla marcada). .refine con { message }
  // es el idiom de errores que ya usa analysisSchemas.
  consent: z.boolean().refine((v) => v === true, {
    message: "Necesitamos tu consentimiento para escribirte",
  }),
  source: z.string().trim().max(40).optional().default("informes"),
});

export type NewsletterRequest = z.infer<typeof NewsletterRequestSchema>;

