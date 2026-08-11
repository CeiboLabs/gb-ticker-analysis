/**
 * Etiqueta de plantilla para los bloques de estilo de los componentes.
 *
 * ── QUÉ RESUELVE ──────────────────────────────────────────────────────────
 * Este código documenta sus reglas de CSS adentro del propio bloque, que es
 * justamente donde sirven: al lado de la regla que explican. El problema es que
 * un bloque de estilo de un componente se sirve TAL CUAL en el HTML, así que
 * esos comentarios se descargan en cada visita.
 *
 * Medido en /bng-seleccion-global (docs/rendimiento-fondo.md §5): 78,5 KB de
 * estilos embebidos en el HTML, de los cuales 28,4 KB —el 36 %— son comentarios.
 * Son ~8 KB de brotli en cada carga para explicarle al navegador cosas que sólo
 * le importan a quien lee el código.
 *
 * `css` los saca en el camino a la página y los deja intactos en el fuente.
 *
 * ── POR QUÉ EN RUNTIME Y NO EN EL BUILD ───────────────────────────────────
 * Porque el texto de un bloque de estilo es contenido que React HIDRATA: si el
 * server manda un texto y el cliente produce otro, la comparación falla y la
 * página entera se vuelve a renderizar en el cliente. (Está documentado en
 * app/(fondo)/bng-seleccion-global/page.tsx y se confirmó midiendo: al recortar
 * los comentarios sobre el HTML ya construido, el TBT SUBÍA.)
 *
 * Esta función corre en los dos lados y es pura, así que los dos textos son
 * idénticos por construcción. El costo es una pasada de regex por bloque, una
 * sola vez por módulo: el array de una plantilla etiquetada es estable, así que
 * el resultado se memoiza contra él.
 *
 * ⚠️ Lo que esto NO arregla: el comentario sigue viajando en el chunk de JS del
 * componente cliente, porque ahí vive el literal. Sacarlo de ahí necesita una
 * transformación del bundler, que es otra discusión.
 *
 * ── USO ───────────────────────────────────────────────────────────────────
 *   import { css } from "@/lib/css";
 *   ...
 *   <style>{css`
 *     .algo { color: red; }
 *   `}</style>
 *
 * Y siguen valiendo las dos trampas de siempre para el contenido del bloque:
 * nada de acentos graves adentro (cierran la plantilla), y nada de escribir la
 * etiqueta de estilos entre ángulos.
 */

const memo = new WeakMap<TemplateStringsArray, string>();

export function css(partes: TemplateStringsArray, ...valores: unknown[]): string {
  // Sin interpolaciones el resultado depende sólo del literal, y el array de la
  // plantilla es el mismo objeto en cada render: se calcula una vez por módulo.
  if (valores.length === 0) {
    const guardado = memo.get(partes);
    if (guardado !== undefined) return guardado;
    const limpio = limpiar(partes[0]);
    memo.set(partes, limpio);
    return limpio;
  }
  // Con interpolaciones se arma primero y se limpia después: así un comentario
  // que envuelva una interpolación se saca entero, y no por pedazos.
  let salida = partes[0];
  for (let i = 0; i < valores.length; i++) salida += String(valores[i]) + partes[i + 1];
  return limpiar(salida);
}

function limpiar(fuente: string): string {
  return fuente
    // Comentarios de CSS. No hay riesgo de comerse un "/*" que viva dentro de
    // una cadena o de un data URI: en este repo no existe ninguno, y si algún
    // día aparece, se pone el estilo en un archivo .css y listo.
    .replace(/\/\*[\s\S]*?\*\//g, "")
    // Lo que queda: sangrías huérfanas y las líneas en blanco que separaban los
    // comentarios del código.
    .replace(/[ \t]+$/gm, "")
    .replace(/\n{2,}/g, "\n")
    .trim();
}
