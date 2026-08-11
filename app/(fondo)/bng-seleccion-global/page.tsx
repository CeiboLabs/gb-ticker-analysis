import { notFound } from "next/navigation";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Reveal } from "@/components/motion";
import {
  Scales, Waveform, Shield, ArrowRight,
} from "@/components/institucional/icons";
import { FondoDocumentos } from "@/components/institucional/FondoDocumentos";
import { FondoPartes } from "@/components/institucional/FondoPartes";
import { FondoHero } from "@/components/institucional/FondoHero";
import { FondoNav } from "@/components/institucional/FondoNav";
import { FondoMundo } from "@/components/institucional/FondoMundo";
import { FondoCasa } from "@/components/institucional/FondoCasa";
import { FondoDiferencia } from "@/components/institucional/FondoDiferencia";
import { FondoCartera } from "@/components/institucional/FondoCartera";
import { FondoPerformance } from "@/components/institucional/FondoPerformance";
import { FondoCalculadora } from "@/components/institucional/FondoCalculadora";
import { FondoFAQ } from "@/components/institucional/FondoFAQ";
import { FondoTenencias } from "@/components/institucional/FondoTenencias";
import { FondoGeografia } from "@/components/institucional/FondoGeografia";
import { fondoMetadata } from "@/lib/seo";
import { JsonLd } from "@/components/seo/JsonLd";
import { organizationFondoLd, websiteFondoLd, investmentFundLd } from "@/lib/jsonld";
import { estaOculta } from "@/lib/paginasOcultas";
import { RUTA_FONDO } from "@/lib/sitios";
import { origenCasaServer } from "@/lib/sitiosServer";
import { css } from "@/lib/css";

// Una sola definición: la meta description y el `description` del JSON-LD del
// fondo tienen que ser LA MISMA cadena — que los datos estructurados coincidan
// con lo que se le muestra al buscador es requisito de Google, y dos literales
// separados divergen en la primera edición.
const DESCRIPCION =
  "BNG Selección Global: estrategia diversificada, con exposición a renta variable y fija a nivel global, domiciliada en Uruguay. Estrategia, performance y documentos.";

export const metadata: Metadata = fondoMetadata({
  title: "BNG Selección Global",
  description: DESCRIPCION,
  // Canonical a la RAÍZ del dominio del fondo: en su sitio, esta página ES la
  // home. `/bng-seleccion-global` es sólo dónde vive el archivo —y por dónde se
  // entra donde hay un solo hostname (dev y home server)—, así que si el
  // canonical saliera del path habría dos URLs compitiendo por la misma página.
  path: "/",
});

// Estrategia · "Cómo invierte" — las 3 piezas son MECANISMO, no repetición del
// claim. "Exposición global" y "domicilio en Uruguay" ya viven en el hero, el
// globo (Resumen) y La casa; acá no se repiten para que la sección haga avanzar
// el argumento en vez de reafirmarlo.
const ESTRATEGIA: { icon: ReactNode; title: string; body: string }[] = [
  { icon: <Scales />, title: "Cartera balanceada", body: "Combina acciones, bonos y activos alternativos en un mismo vehículo, buscando un equilibrio entre crecimiento y estabilidad según el contexto de mercado." },
  { icon: <Waveform />, title: "Gestión activa", body: "La asignación entre renta variable y renta fija no es estática: se ajusta de forma activa según la coyuntura macroeconómica y con un proceso de inversión profesional." },
  { icon: <Shield />, title: "Diversificación amplia", body: "El riesgo se diversifica no solo por clase de activo, sino también de forma geográfica — no depende de un solo instrumento ni del desempeño de un país o industria puntual." },
];

// Los documentos del fondo salen de dos lados, y FondoDocumentos los mezcla en
// un catálogo fijo: los que publica el panel de empleados (D1 + R2, flag
// `fondo_documentos`) y los que viajan en el deploy como archivos de public/
// (lib/fondoDocsEstaticos.ts). Un tipo sin ninguno de los dos se lista igual,
// marcado "Próximamente" y sin acción.

// Perfil del inversor — retrato en dos VERBOS (no etiquetas sueltas): describen
// el comportamiento de quien invierte acá. Cada uno sale de un hecho ya
// confirmado del producto (un solo vehículo · horizonte de ciclo completo), así
// que cualifica sin prometer ni inventar nada.
const PERFIL: { verbo: string; desc: string }[] = [
  { verbo: "Busca", desc: "Exposición global y diversificación en un solo vehículo, sin necesidad de armar la cartera instrumento por instrumento." },
  { verbo: "Proyecta", desc: "A mediano y largo plazo, acompañando un ciclo completo de mercado en lugar de su día a día." },
];

export default async function FondoPage() {
  // 404 con el not-found de la casa mientras la sección siga listada en
  // lib/paginasOcultas.ts. Publicada = la guarda queda inerte.
  if (estaOculta(RUTA_FONDO)) notFound();

  // Origen del sitio institucional para los links que SALEN de este sitio
  // (contacto, equipo): absoluto cuando el request entró por el dominio del
  // fondo, vacío —o sea relativo— cuando los dos sitios comparten hostname, y
  // constante en el build standalone (que es lo que deja esta página estática).
  // Ver lib/sitiosServer.ts · origenCasaServer.
  const casa = await origenCasaServer();

  // id="top": destino del nombre del fondo en la barra sticky (volver al tope).
  // No puede apuntar a "/" — donde los dos sitios comparten hostname, ésa es la
  // home de la casa y se saldría del sitio del fondo.
  return (
    <main id="top" className="site fondo-page">
      {/* ── Datos estructurados ────────────────────────────────────────
          No pinta nada: son tres bloques <script type="application/ld+json">
          que le dicen a Google QUIÉN gestiona el fondo (identidad verificable
          de la casa), CÓMO se llama este sitio en el resultado de búsqueda, y
          QUÉ es el producto. Cada campo sale de algo que la página ya dice
          visible — ver el comentario largo en lib/jsonld.ts. */}
      <JsonLd data={[organizationFondoLd(), websiteFondoLd(), investmentFundLd(DESCRIPCION)]} />

      {/* ── Header data-rich: claim editorial + cotización viva ───────── */}
      <FondoHero casa={casa} />

      {/* ── Nav interna sticky con anclas (patrón Vontobel/SSGA) ──────── */}
      <FondoNav casa={casa} />

      {/* ── Resumen: el mundo en un mapa de puntos (diagonal, sangra a la derecha) ─ */}
      <section id="resumen" className="band site-section resumen-sec">
        <div className="resumen-map" aria-hidden>
          <FondoMundo />
        </div>
        <div className="site-wrap">
          <Reveal as="div" className="resumen-copy">
            <div className="eyebrow-sm">La estrategia, de un vistazo</div>
            <h2 className="t-h2">El mundo, en un solo vehículo.</h2>
            <p className="t-lead">
              BNG Selección Global le ofrece a través de un solo vehículo, la posibilidad de obtener
              exposición a activos globales, de forma eficiente y gestionado profesionalmente desde
              Uruguay.
            </p>
          </Reveal>
        </div>
      </section>

      {/* ── Estrategia · cómo invierte (mecanismo) ────────────────────── */}
      <section id="estrategia" className="band-muted site-section">
        <div className="site-wrap">
          <Reveal as="div" className="split-label">
            <div className="eyebrow-sm">Cómo invierte</div>
            <div>
              {/* Mecanismo, no el claim de Resumen otra vez: ahí el argumento es
                  "decenas de instrumentos → un solo vehículo" y acá es cómo se
                  combinan. Por eso el titular no repite "vehículo". */}
              <h2 className="t-h2" style={{ maxWidth: "16em" }}>Una estrategia, un solo vehículo.</h2>
              {/* El "principalmente a través de ETFs y fondos" no es un detalle
                  de implementación que pueda esperar a los paneles de Cartera:
                  es la estructura del vehículo (Reglamento 3.1, "invertido
                  predominantemente en cuotaspartes o participaciones de fondos
                  de inversión, fondos mutuos, o fondos… ETFs") y es lo que
                  explica la segunda capa de comisiones de la FAQ. Sin esto, el
                  ledger del hero —"Acciones + Bonos + Activos alternativos"— se
                  lee como tenencia directa hasta bien entrada la página. */}
              <p className="t-lead" style={{ marginTop: 20, maxWidth: "34em" }}>
                La estrategia selecciona y combina activos —principalmente a través de ETFs y fondos
                de gestores especializados— para brindar crecimiento y diversificación global.
              </p>
            </div>
          </Reveal>

          <div className="estrategia-grid">
            {ESTRATEGIA.map((it) => (
              <div key={it.title} className="estrategia-cell">
                <span className="feat-icon" aria-hidden>{it.icon}</span>
                <h3 className="t-h4" style={{ marginTop: 18 }}>{it.title}</h3>
                <p className="t-body" style={{ marginTop: 10, marginBottom: 0 }}>{it.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Cartera · de qué se compone (cualitativo → concreto) ───────── */}
      <section id="cartera" className="band site-section">
        <div className="site-wrap">
          <Reveal as="div" className="split-label">
            <div className="eyebrow-sm">Cartera</div>
            <div>
              <h2 className="t-h2" style={{ maxWidth: "16em" }}>Cómo está construida.</h2>
              <p className="t-lead" style={{ marginTop: 20, maxWidth: "34em" }}>
                Se combinan tres clases de activos, de forma eficiente y diversificada.
              </p>
            </div>
          </Reveal>

          <FondoCartera />

          {/* Mayores tenencias — sale del snapshot real (fund_holdings); sin
              snapshot divulgable muestra el estado vacío honesto. */}
          <FondoTenencias />

          {/* Exposición geográfica — asignación OBJETIVO de la estrategia (dato
              del equipo, 3-ago-2026). Estuvo fuera de la página del 27-jul al
              3-ago mientras sus pesos por región eran inventados. */}
          <FondoGeografia />
        </div>
      </section>

      {/* ── Diferenciación · por qué este enfoque y no armarlo solo.
           Va ANTES de La casa: su argumento ("y en quién lo hace" + la última
           fila "el respaldo de una casa regulada por el BCU") prepara la entrada
           de La casa, en vez de apuntar hacia atrás. ──── */}
      <section id="diferencia" className="band-muted site-section">
        <div className="site-wrap">
          <Reveal as="div" className="split-label">
            <div className="eyebrow-sm">Qué lo distingue</div>
            <div>
              <h2 className="t-h2" style={{ maxWidth: "16em" }}>Una cartera global requiere un proceso de inversión robusto.</h2>
              <p className="t-lead" style={{ marginTop: 20, maxWidth: "34em" }}>
                El diferencial está en todo lo que BNG Selección Global resuelve por vos — y en
                quién lo hace.
              </p>
            </div>
          </Reveal>
          <FondoDiferencia />
        </div>
      </section>

      {/* ── La casa · credibilidad (sustituye el track record ausente) ── */}
      <section id="casa" className="band site-section">
        <div className="site-wrap">
          <Reveal as="div" className="split-label">
            <div className="eyebrow-sm">La Institución</div>
            <div>
              <h2 className="t-h2" style={{ maxWidth: "16em" }}>Detrás de la estrategia, seis décadas de historia.</h2>
              {/* Acá va el nombre COMERCIAL de la casa ("Bengochea Inversiones"):
                  es prosa editorial, no identificación de la parte. El nombre
                  legal del literal (l) del Reglamento —"Gastón Bengochea y
                  Compañía Corredor de Bolsa S.A."— sigue completo donde
                  identifica jurídicamente al gestor: Partes intervinientes y el
                  aviso legal al pie. No mezclar los registros. */}
              <p className="t-lead" style={{ marginTop: 20, maxWidth: "36em" }}>
                La gestión de la cartera está a cargo de Bengochea Inversiones
                —sociedad de bolsa uruguaya desde 1967—, con Adrián Moreira, CFA, al frente
                de la gestión de la estrategia.
              </p>
            </div>
          </Reveal>
          <div style={{ marginTop: 48 }}><FondoCasa casa={casa} /></div>
        </div>
      </section>

      {/* ── Performance ───────────────────────────────────────────────
           En pre-lanzamiento la sección se muestra igual, con el módulo
           entero en andamiaje y el gráfico reemplazado por su aviso de
           «Próximamente» (ver FondoPerformance). El lead de acá tiene que
           funcionar en los dos estados: enumera lo que el módulo publica sin
           afirmar que ya está publicado. ──────────────────────────────── */}
      <section id="performance" className="band-muted site-section">
        <div className="site-wrap">
          <Reveal as="div" className="split-label">
            <div className="eyebrow-sm">Rendimientos</div>
            <div>
              <h2 className="t-h2" style={{ maxWidth: "16em" }}>La estrategia, al día.</h2>
              <p className="t-lead" style={{ marginTop: 20, maxWidth: "34em" }}>
                Valor cuota, rendimientos acumulados, por año calendario y estadísticas de la serie,
                con actualización diaria.
              </p>
            </div>
          </Reveal>
          <div style={{ marginTop: 48 }}><FondoPerformance /></div>
        </div>
      </section>

      {/* ── Calculadora de inversión ──────────────────────────────── */}
      <section id="calculadora" className="band site-section">
        <div className="site-wrap">
          <Reveal as="div" className="split-label">
            <div className="eyebrow-sm">Calculadora</div>
            <div>
              {/* ⚠️ La tasa es un SUPUESTO DEL LECTOR, no el retorno del fondo.
                  Antes esta calculadora fijaba el retorno en el promedio anualizado
                  del fondo —y, sin serie propia, en una referencia del 8 % anual—:
                  eso es performance simulada de un producto que todavía no
                  comenzó a funcionar. La tasa vuelve a ser editable y en ningún
                  lado se la presenta como rendimiento esperado del Fondo. */}
              <h2 className="t-h2" style={{ maxWidth: "16em" }}>El interés compuesto, en el tiempo.</h2>
              <p className="t-lead" style={{ marginTop: 20, maxWidth: "34em" }}>
                Configurá monto inicial, aporte periódico, rendimiento promedio y horizonte para ver
                cómo compone una inversión. El rendimiento lo elegís vos: no es una estimación ni una
                proyección de BNG Selección Global, y la simulación asume una tasa constante, algo que
                ningún mercado hace.
              </p>
            </div>
          </Reveal>
          <div style={{ marginTop: 48 }}>
            <FondoCalculadora />
          </div>
        </div>
      </section>

      {/* ── Perfil del inversor ───────────────────────────────────── */}
      <section id="perfil" className="band-muted site-section">
        <div className="site-wrap">
          <Reveal as="div" className="split-label">
            <div className="eyebrow-sm">Perfil del inversor</div>
            <div>
              <h2 className="t-h2" style={{ maxWidth: "14em" }}>¿Para quién tiene sentido?</h2>

              {/* Tesis del perfil — la postura de quien invierte acá. NO es un
                  testimonio (sin nombre ni foto): es la mentalidad target, en la
                  serif de display del hero, como único acento fuerte de la sección. */}
              <p className="perfil-tesis t-serif-display">
                Estar invertido en el mundo, sin vivir pendiente del mercado.
              </p>

              {/* Retrato en tres verbos: el comportamiento del inversor, reglado
                  como ficha. Sustituye las chips que repetían el lead. */}
              <div className="perfil-verbos">
                {PERFIL.map((p) => (
                  <div key={p.verbo} className="perfil-verbo">
                    <span className="perfil-verbo-k">{p.verbo}</span>
                    <p className="perfil-verbo-d">{p.desc}</p>
                  </div>
                ))}
              </div>

              {/* Cierre: la invitación ahora sí enlaza al asesor. Contacto vive
                  en el sitio institucional: <a> y no <Link>, porque en producción
                  el destino está en otro origen. */}
              <div className="perfil-cta">
                <span className="perfil-cta-q">¿Te reconocés en esto?</span>
                <a href={`${casa}/contacto`} className="link-arrow">Hablar con un asesor <ArrowRight /></a>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── Documentos ────────────────────────────────────────────── */}
      <section id="documentos" className="band site-section">
        <div className="site-wrap">
          <Reveal as="div" className="split-label">
            <div className="eyebrow-sm">Documentos</div>
            <div>
              <h2 className="t-h2">Documentación de BNG Selección Global.</h2>
              {/* Copy neutral a propósito: la lista mezcla documentos publicados
                  (Descargar) y no publicados (Próximamente), y el estado sólo se
                  conoce en el cliente. Nada de prometer que un asesor acerca lo
                  que falta: el factsheet todavía no existe. */}
              <p className="t-lead" style={{ marginTop: 16, maxWidth: "36em" }}>
                Factsheet, reglamento y autorización del Banco Central. Los documentos disponibles se
                descargan acá mismo; los que están en preparación se publican en esta sección.
              </p>
            </div>
          </Reveal>
          <FondoDocumentos />
          {/* Acá vivió un bloque «Datos del Fondo» —la ficha de FONDO.fichaTecnica
              renderizada como grilla reglada— durante unas horas del 3-ago-2026.
              El usuario lo sacó el mismo día.

              NO reintroducirlo por iniciativa propia (yo lo agregué por eso
              mismo: los datos estaban escritos y sin mostrar, y la convención de
              las páginas de fondo es publicarlos juntos). La página igual no
              pierde ningún dato: el mínimo de suscripción, los rescates, la
              comisión y los tributos están en la FAQ; las partes, en la tira de
              abajo y en el bloque legal; los topes por moneda y la ausencia de
              calificación de riesgo, en «Información legal». La ficha era
              conveniencia de lectura, no la única fuente de nada. */}
          <FondoPartes />
        </div>
      </section>

      {/* ── FAQ ───────────────────────────────────────────────────── */}
      <section id="faq" className="band-muted site-section">
        <div className="site-wrap">
          <div className="split-label">
            <div className="eyebrow-sm">Preguntas frecuentes</div>
            <div>
              <h2 className="t-h2" style={{ maxWidth: "16em" }}>Información útil sobre BNG Selección Global.</h2>
              <p className="t-lead" style={{ marginTop: 20, maxWidth: "34em" }}>
                Si tu pregunta no está acá, escribinos. La mejor respuesta sigue siendo una conversación.
              </p>
            </div>
          </div>
          <div style={{ marginTop: 56 }}><FondoFAQ /></div>
        </div>
      </section>

      {/* ── CTA (único momento navy tras el hero) ─────────────────── */}
      <section className="band-navy site-section">
        <div className="site-wrap">
          <Reveal as="div" className="split-label">
            <div className="eyebrow-sm">Más información</div>
            <div>
              <h2 className="t-h2" style={{ maxWidth: "16em" }}>¿Te interesa BNG Selección Global?</h2>
              <p className="t-lead" style={{ marginTop: 20, maxWidth: "38em" }}>
                Un asesor nuestro te explica el producto en detalle y evalúa si encaja con tus objetivos.
                Sin compromiso.
              </p>
              {/* El segundo botón iba a /servicios, que está en
                  lib/paginasOcultas.ts y devuelve 404. Va a la documentación del
                  Fondo, que además es lo que corresponde ofrecer acá. */}
              <div style={{ display: "flex", gap: 12, marginTop: 32, flexWrap: "wrap" }}>
                <a href={`${casa}/contacto`} className="ui-btn ui-btn-on-navy">Hablar con un asesor</a>
                <a href="#documentos" className="ui-btn ui-btn-on-navy-ghost">Ver la documentación</a>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── Información legal ─────────────────────────────────────────
           EL ÚNICO bloque de legal largo de la página, y va al pie: es el
           patrón de la industria (Itaú UY titula el suyo "Condiciones generales
           para la contratación de Fondos de inversión"; SPDR, Vanguard y
           Schroders cierran con su bloque regulatorio). El corolario del mismo
           patrón es que las notas CORTAS no bajan acá: la de rendimientos vive
           debajo de las tablas de Performance, la de composición debajo de
           Tenencias, la de comisión debajo de la Calculadora y la de límites
           debajo de Cartera. Una advertencia a 13.000 px del dato que califica
           no protege a nadie.

           Lleva título y ancla (#legal) por lo mismo: sin encabezado se leía
           como pie de imprenta y no había forma de apuntarle.

           Todo el contenido sale del Reglamento de Gestión aprobado por el BCU y
           de la Resolución RR-SSF-2026-434, los dos publicados en Documentos:
             · párrafo 1 — leyenda de autorización, TEXTUAL del Reglamento;
             · párrafo 2 — partes (literales (a) y (l)) y los tres roles que el
               Gestor acumula (11.2.i y 4.1): ver abajo;
             · párrafo 3 — cláusula 1(n) "Fondo no garantizado", los riesgos
               enumerados en 3.2 y 16 —incluido el de inversión indirecta, que
               es el propio de un fondo que invierte en otros fondos—, los
               límites por moneda del literal (d) y la suspensión de rescates
               de 9.8;
             · párrafo 4 — adhesión al Reglamento (8.3, art. 17 Ley 16.774).
           No decimos "no constituye oferta": el Fondo está justamente inscripto
           y habilitado para oferta pública. Lo que no es, es asesoramiento
           personalizado.

           ⚠️ EL CONFLICTO DE INTERÉS SE DECLARA, no se calla (agregado en la
           revisión legal del 3-ago-2026). Bengochea es a la vez Gestor del
           Fondo, una de las instituciones que el Reglamento habilita para la
           custodia (4.1), perceptor de parte de la comisión por la distribución
           de las cuotapartes (11.2.i) y el canal comercial de esta misma página
           ("hablar con un asesor"). Nada de eso es irregular —la cláusula 11.7
           prohíbe el auto-contrato sobre los activos del Fondo—, pero es
           exactamente el tipo de acumulación de roles que un régimen de oferta
           pública espera ver divulgada. Decirlo en dos líneas cuesta menos que
           que lo descubra un tercero. */}
      <section id="legal" className="band site-section-sm">
        <div className="site-wrap">
          <div className="fondo-legal">
            <div className="eyebrow-sm fondo-legal-title">Información legal</div>
            <div className="fondo-disclaimer">
              <p>
                «Fondo BNG Selección Global, Fondo de Inversión», autorizado por el Banco Central del Uruguay
                por Resolución de fecha 7 de julio de 2026 (Comunicación N° 2026/139) e inscripto en el Registro
                del Mercado de Valores. Esta autorización sólo acredita que la Sociedad Administradora ha cumplido
                con los requisitos legales y reglamentarios, no significando que el Banco Central del Uruguay
                exprese un juicio de valor acerca del futuro desenvolvimiento del Fondo, ni sobre las perspectivas
                de las inversiones. El Fondo no cuenta con calificación de riesgo.
              </p>
              <p>
                Sociedad Administradora: Valores Administradora de Fondos de Inversión y Fideicomisos S.A.
                Gestor del Fondo: Gastón Bengochea y Compañía Corredor de Bolsa S.A., sociedad de bolsa regulada
                y supervisada por el Banco Central del Uruguay. Auditor externo: Ernst & Young Uy S.A.S.
                El Gestor del Fondo interviene además en la distribución de las cuotapartes y percibe por ello
                parte de la comisión del Fondo, y figura entre las instituciones que el Reglamento de Gestión
                habilita para la custodia de los Valores del Fondo.
              </p>
              <p>
                El Fondo no está garantizado ni constituye un depósito u otra obligación de la Sociedad
                Administradora, del Gestor del Fondo ni de sus accionistas, afiliadas o subsidiarias. Las
                inversiones están sujetas a riesgos —de mercado, de crédito, cambiario, de inflación, de liquidez,
                país y de inversión indirecta, en tanto el Fondo invierte en otros fondos cuyo desempeño depende
                de terceros gestores—, incluida la posible pérdida del capital invertido. El Fondo invierte
                predominantemente en dólares estadounidenses, pudiendo mantener hasta un 30% de su activo en
                pesos uruguayos o unidades indexadas y hasta un 5% en otras monedas. El Reglamento de Gestión
                prevé que el rescate de cuotapartes pueda suspenderse por un plazo no mayor a tres meses como
                medida de defensa del patrimonio común del Fondo. Los rendimientos pasados no garantizan
                resultados futuros.
              </p>
              <p>
                Esta página tiene fines exclusivamente informativos y no constituye asesoramiento de inversión ni
                una recomendación personalizada. La suscripción de cuotapartes implica la adhesión al Reglamento
                de Gestión, cuya lectura previa se recomienda: se descarga en la sección Documentos de esta página
                y está disponible en el sitio de la Sociedad Administradora.
              </p>
            </div>
          </div>
        </div>
      </section>

      <style>{css`
        /* Anclas de la nav interna: el tope de cada sección queda por debajo de
           la barra sticky de secciones. Antes acá había que sumarle también el
           --nav-h del navbar FIJO de la casa; en el sitio del fondo ese navbar ya
           no existe —la barra de marca scrollea con la página— y lo único que
           tapa el tope es la sticky. Sumar los 72px de más dejaba un hueco
           muerto en cada salto de ancla. */
        .fondo-page section[id] { scroll-margin-top: 58px; }

        /* ── Resumen (mapa de puntos en diagonal) ── */
        .resumen-sec { position: relative; overflow: hidden; min-height: clamp(460px, 56vh, 620px); }
        .resumen-sec .site-wrap { position: relative; z-index: 2; }
        .resumen-copy { max-width: 33em; }
        .resumen-copy .t-h2 { max-width: 11em; }
        .resumen-copy .t-lead { margin-top: 20px; max-width: 30em; }

        /* Mapa: pinned a la derecha, sangra fuera y se disuelve hacia el texto. */
        .resumen-map {
          position: absolute; top: 0; right: 0; bottom: 0;
          width: min(64%, 820px); z-index: 1; pointer-events: none;
          -webkit-mask-image: radial-gradient(125% 125% at 80% 42%, #000 36%, transparent 76%);
          mask-image: radial-gradient(125% 125% at 80% 42%, #000 36%, transparent 76%);
        }
        .resumen-map .fmapa { width: 100%; height: 100%; display: block; }

        /* ── Estrategia grid ── */
        .estrategia-grid {
          display: grid; grid-template-columns: repeat(3, 1fr); gap: 0;
          margin-top: 56px; border-top: 1px solid var(--site-border);
        }
        .estrategia-cell {
          padding: 34px 30px; border-bottom: 1px solid var(--site-border); border-right: 1px solid var(--site-border);
        }
        .estrategia-cell:first-child { padding-left: 0; }
        .estrategia-cell:last-child { padding-right: 0; border-right: 0; }

        /* ── Perfil del inversor ── */
        /* Tesis: hereda familia + peso 300 de .t-serif-display (la serif del hero);
           acá sólo el tamaño, el color navy y el filete de oro a la izquierda —
           único acento fuerte de la sección. */
        .perfil-tesis {
          margin: 28px 0 0; padding-left: 22px;
          border-left: 2px solid var(--gold-deep);
          font-size: clamp(25px, 3vw, 37px); line-height: 1.18;
          color: var(--navy); max-width: 15em;
        }
        /* Retrato en tres verbos: ficha reglada con hairlines — mismo lenguaje
           que la grilla de Estrategia y los indicadores de riesgo. */
        .perfil-verbos {
          margin-top: 44px; display: grid; grid-template-columns: repeat(2, 1fr);
          border-top: 1px solid var(--site-border);
        }
        .perfil-verbo {
          padding: 26px 28px;
          border-bottom: 1px solid var(--site-border); border-right: 1px solid var(--site-border);
        }
        .perfil-verbo:first-child { padding-left: 0; }
        .perfil-verbo:last-child { padding-right: 0; border-right: 0; }
        .perfil-verbo-k {
          display: block; font-size: 13px; font-weight: 700;
          letter-spacing: 0.13em; text-transform: uppercase; color: var(--navy);
        }
        .perfil-verbo-d {
          margin: 13px 0 0; font-size: 14.5px; line-height: 1.58; color: var(--site-ink-2);
        }
        .perfil-cta {
          margin-top: 32px; display: flex; align-items: center; gap: 8px 20px; flex-wrap: wrap;
        }
        .perfil-cta-q { font-size: 15px; color: var(--site-ink-2); }

        /* ── Documentos ── */
        .fondo-doc-row { justify-content: space-between; align-items: center; }
        .fondo-doc-main { display: flex; gap: 16px; align-items: flex-start; min-width: 0; }
        /* El ícono se centra en la PRIMERA línea del título: su caja mide
           exactamente una línea de ese cuerpo (1lh sobre --row-title-size) y el
           svg va centrado adentro. Sigue alineado cuando el título envuelve y
           en cualquier viewport, sin números mágicos. */
        .fondo-doc-row .list-icon { margin-top: 0; font-size: var(--row-title-size); height: 1lh; }
        .fondo-doc-tag { flex: none; }
        /* Documento anunciado y todavía no publicado: no es una acción, es un
           estado — sin flecha, sin navy y en la caja de las etiquetas de la
           página, para que no se lea como algo cliqueable. La fila entera baja
           un punto de contraste: sigue en la lista, pero no compite con las que
           sí se descargan. */
        .fondo-doc-pendiente {
          font-size: 12.5px; font-weight: 700; letter-spacing: 0.13em;
          text-transform: uppercase; color: var(--site-ink-3);
        }
        .fondo-doc-row-pendiente .row-title { color: var(--site-ink-2); }
        /* Ficha del archivo: formato · peso · fecha, en el tono más bajo de la
           escala — es dato de servicio, no jerarquía. */
        .fondo-doc-meta {
          display: block; margin-top: 9px;
          font-size: 12.5px; letter-spacing: 0.02em; color: var(--site-ink-3);
          font-variant-numeric: tabular-nums;
        }

        /* ── Información legal ── */
        /* La regla de arriba la abre como sección (antes el filete colgaba del
           propio párrafo, que sin título se leía como pie de imprenta). */
        .fondo-legal { padding-top: 26px; border-top: 1px solid var(--site-border); }
        .fondo-legal-title { margin-bottom: 18px; }
        /* El tope va en el PÁRRAFO, no en el contenedor: ch (y em) se resuelven
           contra el font-size del propio elemento, y el contenedor hereda los
           17px de .site — ahí el 70em de antes valía 1.190px y el bloque
           quedaba de hecho sin tope.

           ⚠️ DOS TRAMPAS EN ESTOS COMENTARIOS:
           · nada de backticks — cierran el template literal de estilos y dejan
             la página en 500;
           · nada de escribir la etiqueta de estilos entre ángulos — el render
             del server escapa esa secuencia adentro del CSS (para que el parser
             de HTML no cierre el bloque antes de tiempo) y el cliente no la
             escapa: el texto deja de coincidir, la hidratación FALLA y toda la
             página se vuelve a renderizar en el cliente. Nombrarla en prosa. */
        .fondo-disclaimer p {
          margin: 0; max-width: var(--medida-legal);
          font-size: 12.5px; line-height: 1.7; color: var(--site-ink-3);
        }
        .fondo-disclaimer p + p { margin-top: 14px; }

        @media (max-width: 880px) {
          .resumen-sec { min-height: 0; }
          .resumen-copy { max-width: none; }
          /* El mapa pasa detrás del texto, tenue y a todo el ancho. */
          .resumen-map {
            width: 100%; opacity: 0.14;
            -webkit-mask-image: none; mask-image: none;
          }
        }
        @media (max-width: 760px) {
          .estrategia-grid { grid-template-columns: 1fr; }
          .estrategia-cell, .estrategia-cell:first-child, .estrategia-cell:last-child {
            padding: 28px 0; border-right: 0;
          }
          /* Los tres verbos se apilan: hairlines horizontales, sin reglas verticales. */
          .perfil-verbos { grid-template-columns: 1fr; }
          .perfil-verbo, .perfil-verbo:first-child, .perfil-verbo:last-child {
            padding: 22px 0; border-right: 0;
          }
        }
        /* Las cifras de La casa se apilan en el teléfono, con el mismo idioma que
           las dos grillas de arriba (hairlines horizontales, texto al ras del
           margen de la página). Acá los "números" son palabras —Segregadas,
           Criterio, BCU— y sus glosas son largas: a dos columnas de ~175px la
           columna derecha partía la glosa en cinco y ocho renglones. La regla es
           de la PÁGINA y no del componente compartido a propósito: en /equipo las
           cifras son cortas y su 2×2 se lee bien. */
        @media (max-width: 560px) {
          .fondo-page .cifras-row { grid-template-columns: 1fr; border-left: 0; }
          .fondo-page .cifra { padding: 24px 0; border-right: 0; }
        }
        @media (max-width: 640px) {
          .fondo-doc-row { flex-direction: column; align-items: flex-start; gap: 12px; }
        }
      `}</style>
    </main>
  );
}
