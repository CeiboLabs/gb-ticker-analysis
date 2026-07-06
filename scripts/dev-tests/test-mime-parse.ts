// Smoke del parser MIME del Email Worker (workers/nav-ingest/src/mime).
// Correr:  npx tsx scripts/dev-tests/test-mime-parse.ts
// Confirma que postal-mime normaliza bien a ParsedEmail y que, sin extractor
// activo (Etapa 3 pendiente), runExtractors devuelve null.

import { parseEmail } from "../../workers/nav-ingest/src/mime";
import { runExtractors } from "../../lib/fondoIngest";

const RAW = [
  "From: Administrador del Fondo <admin@fondos.example>",
  "To: nav-secret@ingest.example",
  "Subject: Valor cuota BNG 2026-06-26",
  "Message-ID: <abc123@fondos.example>",
  "Date: Fri, 26 Jun 2026 10:00:00 -0300",
  "Content-Type: text/plain; charset=utf-8",
  "",
  "Estimados, el valor cuota de hoy 26/06/2026 es 102,3456. AUM USD 12.500.000.",
  "",
].join("\r\n");

let pass = 0;
let fail = 0;
function check(name: string, cond: boolean) {
  if (cond) pass++;
  else { fail++; console.error(`  ✗ ${name}`); }
}

async function main() {
  const p = await parseEmail(RAW);
  console.log("subject :", JSON.stringify(p.subject));
  console.log("text    :", JSON.stringify(p.text.trim().slice(0, 80)));
  console.log("from    :", p.header("from"));
  console.log("msg-id  :", p.header("message-id"));
  console.log("adjuntos:", p.attachments.length);

  check("extrae el subject", p.subject === "Valor cuota BNG 2026-06-26");
  check("extrae el cuerpo", p.text.includes("102,3456"));
  check("header(from) trae la dirección", (p.header("from") ?? "").includes("admin@fondos.example"));
  check("header(message-id) presente", (p.header("message-id") ?? "").includes("abc123"));
  check("sin adjuntos", p.attachments.length === 0);
  // Etapa 3 pendiente: EXTRACTORS vacío ⇒ no se extrae nada todavía.
  check("runExtractors devuelve null (sin extractor activo)", runExtractors(p) === null);

  console.log(`\nmime-parse: ${pass} ok, ${fail} fallaron`);
  if (fail > 0) process.exit(1);
}
main().catch((e) => { console.error(e); process.exit(1); });
