// Helpers de formato del panel, compartidos entre server components (páginas
// del panel) y client components. SIN "use client" a propósito: un módulo
// cliente exporta referencias, no funciones invocables desde el server.

export function fmtTs(ms: number | null | undefined): string {
  if (!ms) return "—";
  return new Date(ms).toLocaleString("es-UY", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Montevideo",
  });
}
