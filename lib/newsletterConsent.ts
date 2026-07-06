// Texto de consentimiento del newsletter — única fuente de verdad, en un módulo
// SIN dependencias (nada de zod) para poder importarlo desde el componente
// cliente sin arrastrar el validador al bundle. Lo MUESTRA el componente y lo
// GUARDA la ruta como prueba del consentimiento (Ley 18.331, Art. 9). Si cambia
// el copy, cambiá esta constante: las altas nuevas quedan selladas con la versión
// vigente.
export const NEWSLETTER_CONSENT_TEXT =
  "Acepto recibir informes, novedades y oportunidades de Bengochea & Cía. por correo. Me puedo dar de baja cuando quiera.";
