// Texto de consentimiento del newsletter — única fuente de verdad, en un módulo
// SIN dependencias (nada de zod) para poder importarlo desde el componente
// cliente sin arrastrar el validador al bundle. Lo MUESTRA el componente y lo
// GUARDA la ruta como prueba del consentimiento (Ley 18.331, Art. 9). Si cambia
// el copy, cambiá esta constante: las altas nuevas quedan selladas con la versión
// vigente.
//
// 2026-07-28 — la segunda oración declara la finalidad de lead_activity: el
// registro de qué análisis consulta cada persona, y para qué (que un asesor
// pueda contactarla). NO es decorativo: lib/leadStore.ts sólo escribe actividad
// de quien tiene EXACTAMENTE este texto sellado en su alta, así que quien se
// anotó bajo el copy anterior no queda registrado hasta que se vuelva a anotar
// bajo éste. Si mañana se guarda algo más que la acción consultada, primero se
// cambia esta constante — el gate de leadStore hace el resto solo.
export const NEWSLETTER_CONSENT_TEXT =
  "Acepto recibir informes, novedades y oportunidades de Bengochea & Cía. por correo, " +
  "y que se registren los análisis que consulto para que un asesor pueda contactarme. " +
  "Me puedo dar de baja cuando quiera.";
