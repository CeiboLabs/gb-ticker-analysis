// Único importador de postal-mime en todo el repo. Aísla la dependencia acá
// para que el bundle de Pages (next-on-pages) nunca la arrastre: nada en app/
// ni lib/ importa este archivo, sólo el Email Worker.
//
// Normaliza el MIME crudo del mail a la forma ParsedEmail que entienden los
// extractores puros de lib/fondoIngest.

import PostalMime from "postal-mime";
import type { ParsedEmail } from "../../../lib/fondoIngest";

type RawInput = ReadableStream<Uint8Array> | ArrayBuffer | Uint8Array | string;

export async function parseEmail(raw: RawInput): Promise<ParsedEmail> {
  const email = await PostalMime.parse(raw);

  // postal-mime devuelve headers como [{ key, value }]; los indexamos en minúscula.
  const headers = new Map<string, string>();
  for (const h of email.headers ?? []) {
    if (h && typeof h.key === "string") headers.set(h.key.toLowerCase(), h.value ?? "");
  }

  return {
    subject: email.subject ?? "",
    text: email.text ?? "",
    html: email.html ?? "",
    attachments: (email.attachments ?? []).map((a) => ({
      filename: a.filename ?? "",
      mimeType: a.mimeType ?? "application/octet-stream",
      content:
        a.content instanceof ArrayBuffer
          ? new Uint8Array(a.content)
          : typeof a.content === "string"
            ? new TextEncoder().encode(a.content)
            : new Uint8Array(),
    })),
    header: (name: string) => headers.get(name.toLowerCase()) ?? null,
  };
}
