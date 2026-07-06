// Arranque del server (Next lo llama una vez, antes de aceptar requests).
// En el home server (runtime Node) registra los bindings locales — SQLite en
// lugar de D1, filesystem en lugar de R2 — vía globalThis, donde
// getMetricsDb()/getDocsBucket() ya los buscan. El import es dinámico y
// gateado por runtime para que better-sqlite3 (addon nativo) jamás entre en
// bundles de edge o de cliente.

export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { registerHomeBindings } = await import("./lib/homeBindings");
  registerHomeBindings();
}
