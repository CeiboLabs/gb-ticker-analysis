import type { ContenidoInforme } from "./tipos";

// Informe semanal del 29 de mayo de 2026 — Ec. Adrián Moreira, CFA.
// Transcripción curada del PDF original (GB INFORME SEMANAL 29-05-2026.pdf).
// Prosa fiel al original; gráficos de retornos y tablas de tasas recreados
// on-brand. La serie diaria del dólar (gráfico de línea del PDF) no está en el
// texto fuente: se representa con su tabla-resumen de retornos en vez de
// inventar una curva. Ver [[feedback_claims_verificables]] / lenguaje-visual §6.
export const semanal_2026_05_29: ContenidoInforme = {
  volanta: "Informe semanal",
  // Titular = síntesis de la casa (no está en el PDF). Ambas cláusulas trazables
  // al informe: inflación "elevada y lejos del objetivo del 2 %" + COPOM que
  // "mantuvo la TPM en 5,75 %". Pendiente: draft anclado con GPT + aprobación.
  titular: "La inflación no cede; el COPOM, sin cambios.",
  bajada:
    "El COPOM mantiene la tasa en 5,75 % y los bonos uruguayos acompañan la baja del Treasury; en la región, Argentina comprime su riesgo país mientras Wall Street digiere un PCE que sigue lejos del 2 %.",
  autor: "Ec. Adrián Moreira, CFA",
  resumen: [
    {
      etiqueta: "Uruguay",
      texto:
        "El COPOM mantiene la tasa en 5,75 % por segunda reunión y los bonos acompañan la baja del Treasury; el dólar cierra en $40,17.",
    },
    {
      etiqueta: "Región",
      texto:
        "Argentina comprime su riesgo país a 488 pb (−13,9 % en el mes) y el Merval trepa 10 %; Brasil cae con la mira en las elecciones.",
    },
    {
      etiqueta: "El mundo",
      // Corregido: se quitó "la Fed se mantiene cauta" (no está en este semanal;
      // provenía del informe mensual). PCE 3,3 % y BCE +25 pb sí están en el PDF.
      texto:
        "El PCE de abril confirma una inflación de 3,3 % que sigue lejos del 2 %; en Europa, el BCE se apronta a subir 25 puntos.",
    },
  ],
  graficoSemana: {
    titulo: "Los que se movieron",
    subtitulo: "Principales índices y activos · variación de la semana",
    datos: [
      { etiqueta: "Merval", valor: 10.07 },
      { etiqueta: "Nikkei", valor: 4.72 },
      { etiqueta: "Nasdaq 100", valor: 2.58 },
      { etiqueta: "S&P 500", valor: 1.8 },
      { etiqueta: "IBOVESPA", valor: -1.24 },
      { etiqueta: "ETH", valor: -4.73 },
      { etiqueta: "BTC", valor: -4.81 },
    ],
    nota: "Variación semanal, en moneda local salvo cripto.",
  },
  bloques: [
    // ── Mercado Local ──────────────────────────────────────────────────────
    { tipo: "seccion", numero: "01", titulo: "Mercado local.", eyebrow: "Uruguay" },
    {
      tipo: "parrafo",
      md: "Esta semana los bonos uruguayos tuvieron un comportamiento al alza, en el mismo sentido que los bonos del tesoro americano.",
    },
    {
      tipo: "parrafo",
      md: "El rendimiento del bono de EE.UU. a 10 años cayó desde 4,56 % a 4,44 %. En el mismo sentido, el bono uruguayo que vence en 2050 pasó de rendir 5,79 % a 5,68 %, a vencimiento. En cuanto al dólar, cotizó al alza, cerrando la semana en $40,17.",
    },
    {
      tipo: "parrafo",
      md: "El martes 26 de mayo se reunió el Comité de Política Monetaria del Banco Central del Uruguay (BCU) y tomó la decisión más esperada de la semana. El COPOM mantuvo la Tasa de Política Monetaria (TPM) en 5,75 % por segunda reunión consecutiva, señalando que el balance de riesgos para la inflación se inclinó levemente al alza por la mayor persistencia del precio del petróleo en niveles elevados.",
    },
    {
      tipo: "cita",
      texto:
        "El Banco Central del Uruguay permanecerá atento a la materialización de los riesgos inflacionarios identificados y actuará en consecuencia si las condiciones lo requieren.",
      fuente: "Comunicado del COPOM · 26 de mayo",
    },
    {
      tipo: "parrafo",
      md: "La Encuesta de Expectativas del BCU de mayo muestra que el mercado financiero proyecta una inflación del 4,65 % para el año calendario 2026 y 4,55 % para 2027, mientras que las expectativas a 24 meses siguen ancladas en la meta de 4,5 %. El ancla de largo plazo se mantiene sólida, lo que le da margen al BCU para actuar con cautela.",
    },
    {
      tipo: "parrafo",
      md: "En síntesis, Uruguay continúa siendo la economía más estable y predecible de la región, con inflación dentro del rango meta, deuda que se coloca a tasas competitivas y un peso que, aunque fuerte, se ajusta gradualmente.",
    },
    {
      tipo: "parrafo",
      md: "Esta semana tuvimos licitaciones de Letras de Regulación Monetaria (LRM) a 28, 77 y 371 días.",
    },
    {
      tipo: "tabla",
      titulo: "Tasas de corte · LRM",
      columnas: [{ titulo: "Plazo (días)" }, { titulo: "Tasa", sufijo: " %" }],
      filas: [
        [28, 5.78],
        [77, 5.91],
        [161, 5.9],
        [371, 6.15],
      ],
    },
    {
      tipo: "tabla",
      titulo: "Dólar y Unidad Indexada · retorno",
      columnas: [
        { titulo: "Ventana" },
        { titulo: "USD", delta: true },
        { titulo: "UI", delta: true },
      ],
      filas: [
        ["Período", 2.74, 11.57],
        ["En el año", 3.29, 2.04],
        ["1 año", -3.4, 3.12],
      ],
      nota: "Variación del dólar y de la Unidad Indexada por ventana temporal.",
    },

    // ── Mercado Regional ───────────────────────────────────────────────────
    { tipo: "seccion", numero: "02", titulo: "Mercado regional.", eyebrow: "América Latina" },
    {
      tipo: "parrafo",
      md: "Las bolsas latinoamericanas tuvieron un comportamiento mixto esta semana, siendo la más perjudicada la de Brasil, cayendo un 1,24 %, mientras que la de Argentina subió un 10,07 %.",
    },
    { tipo: "subtitulo", titulo: "Brasil", volanta: "a cinco meses de las elecciones" },
    {
      tipo: "parrafo",
      md: "A cinco meses de las elecciones presidenciales del 4 de octubre, Lula y Flávio Bolsonaro —designado por su padre Jair como candidato del Partido Liberal— aparecen empatados en los sondeos. Los mercados de predicción muestran una carrera sumamente ajustada. El gasto público —que representa el 19 % del PIB— mantiene una trayectoria creciente con miras a las elecciones, potencialmente respaldado por medidas fiscales y parafiscales contracíclicas. Los inversores prefieren esperar los resultados antes de comprometerse en sectores sensibles al crédito y la inversión.",
    },
    {
      tipo: "parrafo",
      md: "La deuda pública de Brasil se estima en torno al 95 % del PIB para 2026, una carga excepcionalmente alta para una economía emergente. El real cotiza en la zona de 5,15–5,65 por dólar, con perspectivas que dependen en gran medida del resultado electoral y de la credibilidad fiscal del próximo gobierno. El agro, el petróleo y los minerales siguen siendo el motor exportador, beneficiados por la alta demanda china y los precios de las materias primas.",
    },
    { tipo: "subtitulo", titulo: "Argentina", volanta: "el riesgo país cerca de su mínimo" },
    {
      tipo: "parrafo",
      md: "El riesgo país elaborado por JP Morgan cerró el viernes en 488 puntos básicos, acumulando una caída del 13,9 % en mayo. Es su cuarta baja consecutiva en la semana y se ubica a apenas cuatro puntos del mínimo histórico de la gestión Milei, registrado en enero (484 puntos). El quiebre psicológico ocurrió el miércoles: el riesgo país volvió a perforar los 500 puntos y las acciones argentinas treparon hasta un 12 % en Wall Street.",
    },
    {
      tipo: "parrafo",
      md: "El BCRA lleva 94 ruedas consecutivas comprando dólares en el mercado oficial y, con las operaciones de esa jornada, superó el 92 % de su meta de acumulación para todo 2026, habiendo adquirido USD 9.234 millones desde que arrancó la «fase 4» del programa monetario. Se aproxima además la fecha en que MSCI evaluaría un posible cambio de clasificación: si bien aún falta el levantamiento total de las restricciones cambiarias para aspirar a Emerging Market, podría esperarse un upgrade desde Standalone a Frontier Market, lo que habilitaría la entrada de capital institucional y podría impulsar las acciones.",
    },
    { tipo: "subtitulo", titulo: "México", volanta: "la semana más cargada del año" },
    {
      tipo: "parrafo",
      md: "México vivió la semana más cargada de información del año. Banxico recortó su estimación de crecimiento a mínimos en lo que va de la administración Sheinbaum, el PIB del primer trimestre confirmó contracción, y la inflación sigue por encima del objetivo sin perspectivas de converger en el corto plazo. Frente a ese telón de fondo doméstico, el inicio de las negociaciones formales del T-MEC fue el evento de mayor impacto potencial: un acuerdo favorable en julio podría ser el detonante del rebote de la inversión que tanto necesita la economía. Un resultado adverso, en cambio, desencadenaría incertidumbre en las cadenas automotrices y manufactureras, que representan cerca del 80 % de las exportaciones mexicanas.",
    },
    { tipo: "subtitulo", titulo: "Chile", volanta: "litio, inflación y una pausa" },
    {
      tipo: "parrafo",
      md: "La semana estuvo dominada por dos eventos locales de gran impacto: los resultados espectaculares de SQM —con ganancias que se multiplicaron por 2,65 gracias al boom del litio— que impulsaron al IPSA hacia los 10.900 puntos, y el IPC de abril confirmando que la inflación se aceleró al 4 % por el encarecimiento de los combustibles. El dólar se estabilizó en torno a $890, el Banco Central mantiene la pausa en la TPM y el crecimiento del año será modesto. La gran pregunta de los próximos meses es si el acuerdo de paz en Medio Oriente —que haría caer el petróleo y aliviaría la inflación— permite al Banco Central retomar el ciclo de recortes de tasas antes de que termine 2026.",
    },
    {
      tipo: "barras",
      titulo: "Retornos de la semana · región",
      grupos: [
        {
          nombre: "Monedas",
          datos: [
            { etiqueta: "USDCOP", valor: -0.77 },
            { etiqueta: "USDCLP", valor: 1.23 },
            { etiqueta: "USDMXN", valor: 0.0 },
            { etiqueta: "USDARS", valor: -0.64 },
            { etiqueta: "USDPEN", valor: 0.25 },
            { etiqueta: "USDUYU", valor: -0.46 },
          ],
        },
        {
          nombre: "Índices",
          datos: [
            { etiqueta: "IPC MEX", valor: 0.38 },
            { etiqueta: "IBOVESPA", valor: -1.24 },
            { etiqueta: "MERVAL", valor: 10.07 },
            { etiqueta: "CHILE SLCT", valor: 3.15 },
            { etiqueta: "MSCI NUAM", valor: 3.89 },
            { etiqueta: "COLOM COL", valor: 4.49 },
          ],
        },
      ],
      nota: "Variación semanal, en moneda local salvo pares de divisas.",
    },

    // ── Mercado Internacional ──────────────────────────────────────────────
    { tipo: "seccion", numero: "03", titulo: "Mercado internacional.", eyebrow: "El mundo" },
    { tipo: "subtitulo", titulo: "Estados Unidos" },
    { tipo: "subtitulo", titulo: "Inflación", volanta: "sigue por encima del objetivo de la Fed" },
    {
      tipo: "parrafo",
      md: "El dato más esperado de la semana fue el PCE de abril, publicado el jueves 28. El índice PCE subyacente subió un 0,2 % mensual y un 3,3 % interanual, en línea con las estimaciones. La lectura mensual más suave podría ser una señal de que el pico inflacionario de meses anteriores empieza a ceder. Sin embargo, el PCE general avanzó un 3,8 % en términos anualizados en abril, su nivel más alto desde agosto de 2023, mientras que el subyacente alcanzó su mayor nivel desde noviembre de 2023. En resumen, la inflación sigue elevada y lejos del objetivo del 2 % de la Fed.",
    },
    { tipo: "subtitulo", titulo: "Consumo e ingreso", volanta: "el ahorro cae a mínimos" },
    {
      tipo: "parrafo",
      md: "El gasto del consumidor aumentó un 0,5 % en abril, cumpliendo las previsiones. Pero el ingreso personal fue plano, cuando se esperaba un incremento del 0,4 %. Parte del impulso al gasto vino de una reducción del ahorro: la tasa de ahorro personal cayó al 2,6 %, su nivel más bajo desde junio de 2022. Una señal preocupante de que los hogares están consumiendo reservas, no ingreso.",
    },
    { tipo: "subtitulo", titulo: "PIB", volanta: "revisión a la baja en el primer trimestre" },
    {
      tipo: "parrafo",
      md: "La economía creció a una tasa anualizada del 1,6 % en el primer trimestre, por debajo de la estimación inicial del 2 % y de las expectativas del mercado. Es el segundo trimestre consecutivo que el PIB queda por debajo de lo esperado: en el 4Q de 2025 la economía creció apenas un 0,5 %.",
    },
    { tipo: "subtitulo", titulo: "Mercado laboral", volanta: "sólido pero con matices" },
    {
      tipo: "parrafo",
      md: "Las solicitudes iniciales de desempleo para la semana que terminó el 23 de mayo fueron 215.000, un aumento de 5.000 respecto a la semana anterior. El promedio móvil de cuatro semanas fue de 209.000. Los números siguen bajos en términos históricos y no sugieren deterioro del empleo.",
    },
    { tipo: "subtitulo", titulo: "Zona Euro" },
    {
      tipo: "parrafo",
      md: "Se publicaron datos preliminares de inflación de mayo en las principales economías. Los números confirman que los precios siguen subiendo en la mayoría de los países grandes. La gran tensión de política monetaria de la semana fue la combinación de inflación en alza y economía en desaceleración —el escenario más difícil para cualquier banco central. El BCE es ahora ampliamente esperado para subir tasas 25 puntos básicos en su reunión del 11 de junio, elevando su tasa principal al 2,25 %. Los responsables de política coinciden en que el shock energético derivado del conflicto con Irán ya no puede verse como temporal, y expresan mayor preocupación por los efectos de segunda ronda.",
    },
    { tipo: "subtitulo", titulo: "Japón" },
    {
      tipo: "parrafo",
      md: "El rendimiento del bono soberano japonés a 10 años subió hasta el 2,72 % tras los comentarios del vicegobernador Himino sobre la continuidad del ciclo de subidas. Esto es relevante en el contexto japonés, dado que el país tiene la deuda pública más alta del mundo en relación al PIB.",
    },
    { tipo: "subtitulo", titulo: "China" },
    {
      tipo: "parrafo",
      md: "China afronta la semana con una imagen de dos caras: hacia afuera, sigue siendo la potencia exportadora dominante —con el 28 % de los bienes manufacturados globalmente— y ocupa el centro del tablero geopolítico comercial entre EE.UU. y la UE. Hacia adentro, la deflación persistente, el consumo débil y el sector inmobiliario sin recuperar revelan que el crecimiento del 5 % es más frágil de lo que sugiere el titular. La tregua arancelaria con Washington da un respiro transitorio, pero las tensiones con Europa se intensifican y abren un nuevo frente comercial que podría pesar sobre la segunda mitad del año.",
    },
    {
      tipo: "barras",
      titulo: "Retornos de la semana · global",
      grupos: [
        {
          nombre: "América",
          datos: [
            { etiqueta: "Dow Jones", valor: 1.49 },
            { etiqueta: "S&P 500", valor: 1.8 },
            { etiqueta: "Nasdaq 100", valor: 2.58 },
          ],
        },
        {
          nombre: "Europa",
          datos: [
            { etiqueta: "EuroStoxx 50", valor: 0.52 },
            { etiqueta: "FTSE 100", valor: -0.33 },
            { etiqueta: "CAC 40", valor: 0.83 },
            { etiqueta: "DAX", valor: 0.87 },
            { etiqueta: "IBEX", valor: 2.1 },
            { etiqueta: "MIB", valor: 1.06 },
            { etiqueta: "SMI", valor: 1.41 },
          ],
        },
        {
          nombre: "Asia",
          datos: [
            { etiqueta: "Nikkei", valor: 4.72 },
            { etiqueta: "Hang Seng", valor: -0.8 },
            { etiqueta: "Shenzhen", valor: 0.97 },
            { etiqueta: "ASX 200", valor: 0.86 },
          ],
        },
        {
          nombre: "Materias primas y monedas",
          datos: [
            { etiqueta: "BTC", valor: -4.81 },
            { etiqueta: "ETH", valor: -4.73 },
            { etiqueta: "Oro", valor: 0.39 },
            { etiqueta: "Plata", valor: -0.54 },
            { etiqueta: "EUR", valor: 0.41 },
            { etiqueta: "JPY", valor: -0.06 },
          ],
        },
      ],
      nota: "Variación semanal, en %.",
    },
  ],
};
