import { GTM_ID, MEDICION_ACTIVA, snippetGTM } from "@/lib/medicion";

/**
 * Contenedor de Google Tag Manager de la landing del fondo.
 *
 * Componente de SERVER a propósito, y sin `"use client"`: todo lo que hace es que
 * el HTML prerenderizado salga con el snippet adentro. Un `<script>` que React
 * monte en el cliente no se ejecuta nunca (ver `lib/medicion.ts`, `snippetGTM`).
 *
 * Va como primer hijo del layout del fondo, o sea arriba de todo en el `<body>`.
 * La agencia lo pidió en el `<head>` —es la instrucción que copia y pega GTM— pero
 * desde el árbol de React no hay forma de meter un inline ahí sin tocar el layout
 * RAÍZ, que es el de los tres sitios. La diferencia es irrelevante en la práctica:
 * el snippet no hace más que encolar `gtm.start` en el `dataLayer` e insertar un
 * `<script async>`, así que la descarga del contenedor arranca en el mismo tick
 * del parseo. Lo que sí importaba —no colgarlo de la hidratación— está resuelto.
 *
 * El wrapper va `hidden` sólo para que el `<noscript>` de GTM no ocupe una caja
 * en el flujo; el iframe que trae adentro es de 0×0 y ya viene con display:none.
 */
export function MedicionFondo() {
  if (!MEDICION_ACTIVA) return null;

  return <div hidden dangerouslySetInnerHTML={{ __html: snippetGTM(GTM_ID) }} />;
}
