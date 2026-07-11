import type { ContenidoInforme } from "./tipos";

// Informe semanal del 22 de mayo de 2026 — Ec. Adrián Moreira, CFA.
// Transcripción curada del PDF (GB INFORME SEMANAL 22-05-2026.pdf). Prosa fiel al
// original (se limpiaron artefactos de OCR: IBC-Br, T-MEC, S-1, espacios de %);
// los "Retornos Semanales" se recrean como heatmap on-brand.
//
// Los dos gráficos de línea de la página 1 (USD y "UI vs USD base=100") NO están
// en el texto —su serie diaria vive sólo en el Excel del cliente—: se difieren
// hasta el import de Excel (Fase 3); mientras tanto, la tabla-resumen dólar/UI
// (Período/YTD/1 año) representa el dato, como en el 05-29.
//
// Titular = síntesis de la casa (no está en el PDF), trazable al informe: el bono
// de EE.UU. a 30 años "tocó su nivel más alto desde 2007" + dólar "$39,96" +
// Argentina "subió un 5,05 %". Ver [[feedback_claims_verificables]].
export const semanal_2026_05_22: ContenidoInforme = {
  volanta: "Informe semanal",
  titular: "El bono a 30 años toca máximos desde 2007; el dólar afloja y Argentina rebota.",
  bajada:
    "Una intensa venta de deuda soberana global —con el bono largo de EE.UU. en su mayor rendimiento desde 2007 por la guerra con Irán— marca la semana; en Uruguay los bonos ceden y el dólar cierra en $39,96, mientras Argentina trepa 5 % y el PMI europeo se desploma.",
  autor: "Ec. Adrián Moreira, CFA",
  resumen: [
    {
      etiqueta: "Uruguay",
      texto:
        "Los bonos uruguayos ceden —el 2050 pasa a rendir 5,79 %— y el dólar cierra a la baja en $39,96; el PIB de 2025 creció 1,8 %, por debajo de lo previsto.",
    },
    {
      etiqueta: "Región",
      texto:
        "Argentina sube 5,05 % con reservas en máximos; Colombia cae 1,81 % y Brasil modera su impulso con la Selic proyectada en 13,25 %.",
    },
    {
      etiqueta: "El mundo",
      texto:
        "El bono de EE.UU. a 30 años toca su mayor nivel desde 2007 por la guerra con Irán; el PMI compuesto de la Zona Euro se desploma a 47,5.",
    },
  ],
  graficoSemana: {
    titulo: "Los que se movieron",
    subtitulo: "Principales índices y activos · variación de la semana",
    datos: [
      { etiqueta: "Merval", valor: 5.05 },
      { etiqueta: "DAX", valor: 3.92 },
      { etiqueta: "EuroStoxx 50", valor: 3.29 },
      { etiqueta: "Nikkei", valor: 3.14 },
      { etiqueta: "S&P 500", valor: 0.93 },
      { etiqueta: "IBOVESPA", valor: -0.68 },
      { etiqueta: "BTC", valor: -1.25 },
      { etiqueta: "Plata", valor: -8.03 },
    ],
    nota: "Variación semanal, en moneda local salvo cripto y commodities.",
  },
  bloques: [
    // ── Mercado Local ──────────────────────────────────────────────────────
    { tipo: "seccion", numero: "01", titulo: "Mercado local.", eyebrow: "Uruguay" },
    {
      tipo: "parrafo",
      md: "Esta semana los bonos uruguayos tuvieron un comportamiento a la baja, mientras que los bonos del tesoro americano tuvieron un comportamiento al alza.",
    },
    {
      tipo: "parrafo",
      md: "El rendimiento del bono de EE.UU. a 10 años cayó desde 4,60 % a 4,56 %. En el sentido opuesto, el bono uruguayo que vence en 2050 pasó de rendir 5,73 % a 5,79 %, a vencimiento. **En cuanto al dólar, cotizó a la baja, cerrando la semana en $39,96.**",
    },
    {
      tipo: "parrafo",
      md: "La economía uruguaya creció 1,8 % en 2025, por debajo del 2,6 % proyectado en el presupuesto y de lo esperado por el mercado. El pobre desempeño del sector agropecuario en el cuarto trimestre —con una caída del 7,7 %— fue el principal lastre, explicado por menores rindes en cultivos de verano y menor producción maderera. El ministro de Economía, Gabriel Oddone, advirtió que la actividad se ubica por debajo de lo previsto y anticipó revisiones a la baja en las proyecciones para 2026.",
    },
    {
      tipo: "parrafo",
      md: "En el frente exportador, el cuadro es más alentador. Las exportaciones uruguayas alcanzaron USD 3.158 millones en el primer trimestre de 2026, un crecimiento del 9 % interanual. La carne bovina lideró con USD 682 millones (+11 %), seguida por celulosa con USD 524 millones y el concentrado de bebidas con USD 207 millones.",
    },
    {
      tipo: "parrafo",
      md: "El déficit fiscal del sector público consolidado se espera en torno al 2,7 % del PIB para 2026, una mejora respecto al 4,1 % registrado recientemente, con la deuda pública proyectada en torno al 64 %-65 % del PIB.",
    },
    {
      tipo: "parrafo",
      md: "Se llevó a cabo una nueva reapertura de la nota de tesorería en UYU Serie 12, que vence en 2028 y tiene un cupón de 8,5 %. Para esta ocasión, la tasa de corte se situó en 6,72 %.",
    },
    {
      tipo: "parrafo",
      md: "Esta semana tuvimos licitaciones de Letras de Regulación Monetaria (LRM) a 34, 84 y 161 días.",
    },
    {
      tipo: "tabla",
      titulo: "Tasas de corte · LRM",
      columnas: [{ titulo: "Plazo (días)" }, { titulo: "Tasa", sufijo: " %" }],
      filas: [
        [34, 5.8],
        [84, 5.89],
        [161, 5.9],
        [357, 6.01],
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
        ["Período", 2.22, 11.44],
        ["En el año", 2.76, 1.91],
        ["1 año", -3.93, 3.07],
      ],
      nota: "Variación del dólar y de la Unidad Indexada por ventana temporal.",
    },

    // ── Mercado Regional ───────────────────────────────────────────────────
    { tipo: "seccion", numero: "02", titulo: "Mercado regional.", eyebrow: "América Latina" },
    {
      tipo: "parrafo",
      md: "Las bolsas latinoamericanas tuvieron un comportamiento mixto esta semana, siendo la más perjudicada la de Colombia —cayendo un 1,81 %—, mientras que la de Argentina subió un 5,05 %.",
    },
    { tipo: "subtitulo", titulo: "Brasil", volanta: "el impulso se modera" },
    {
      tipo: "parrafo",
      md: "El lunes abrió con el dato del índice IBC-Br, el termómetro de actividad del Banco Central. La actividad económica de Brasil creció 1,3 % en el primer trimestre respecto al trimestre anterior, pero el resultado fue empañado por una caída de 0,7 % en marzo respecto a febrero —peor que el 0,2 % esperado por el mercado—, con todos los sectores rastreados por el Banco Central en baja, incluidos los servicios, el principal motor de la economía. Los economistas lo leyeron como una señal de normalización después de meses muy fuertes, pero también como confirmación de que el impulso se está moderando. Las estimaciones del mercado apuntan a un crecimiento de apenas 1,85 % para todo 2026, desacelerándose desde el 2,3 % del año anterior.",
    },
    {
      tipo: "parrafo",
      md: "Lo más significativo de la semana fue la encuesta Focus del lunes 18 de mayo. El mercado elevó su proyección de la Selic para fin de año de 13,00 % a 13,25 %, una revisión de 0,25 puntos porcentuales que acumula 0,5 puntos de ajuste al alza respecto a un mes atrás, cuando se esperaba terminar 2026 en 12,5 %. Al mismo tiempo, la proyección de inflación para 2026 subió por décima semana consecutiva, pasando del 4,91 % al 4,92 %, consolidándose por encima del límite de la banda de tolerancia de 4,5 %.",
    },
    {
      tipo: "parrafo",
      md: "Brasil entra en la recta final del año electoral con una economía que crece pero pierde impulso, una inflación que no baja al objetivo a pesar de tasas de interés extraordinariamente altas, y un gobierno que sube el gasto con las elecciones en el horizonte. Los mercados están exigiendo más prima de riesgo, y la pregunta central es si el Banco Central tendrá margen real para seguir bajando la Selic o si deberá pausar más tiempo del previsto.",
    },
    { tipo: "subtitulo", titulo: "Argentina", volanta: "reservas en máximos" },
    {
      tipo: "parrafo",
      md: "La semana estuvo marcada por señales positivas en el frente externo —reservas en máximos, superávit comercial histórico, bonos que rebotaron—, pero el desafío estructural persiste: la inflación sigue alta, el tipo de cambio real se aprecia gradualmente dentro de la banda, y el éxito del programa depende en gran medida de mantener el ancla fiscal y cambiaria en un año electoral donde las presiones políticas son crecientes.",
    },
    { tipo: "subtitulo", titulo: "México", volanta: "la revisión del T-MEC en el horizonte" },
    {
      tipo: "parrafo",
      md: "México vive una paradoja: es el país emergente más estratégicamente posicionado de América del Norte gracias al nearshoring y al T-MEC, pero justamente esos activos son los que están en juego. El cierre del ciclo de recortes de Banxico en 6,50 %, la inflación que baja pero lento, y un PIB que se contrajo en el primer trimestre pintan un cuadro de economía frágil. Julio, con la revisión del T-MEC, será el momento de verdad para saber si el potencial se consolida o si la incertidumbre comercial sigue pesando sobre la inversión y el crecimiento.",
    },
    { tipo: "subtitulo", titulo: "Chile", volanta: "el cobre amortigua" },
    {
      tipo: "parrafo",
      md: "Chile entra en la segunda mitad de mayo con una economía que se contrajo en el primer trimestre, una inflación que rebotó desde mínimos históricos empujada por el petróleo caro, y una bolsa en terreno negativo. El cobre por encima de los USD 6 es el principal amortiguador del escenario adverso, aportando recursos fiscales y apuntalando el tipo de cambio. La pregunta central para las próximas semanas es si la economía logra recuperar tracción en el segundo trimestre o si la combinación de ajuste fiscal, energía cara y menor impulso externo empuja al país hacia una recesión técnica.",
    },
    {
      tipo: "retornos",
      titulo: "Retornos de la semana · región",
      grupos: [
        {
          nombre: "Monedas",
          datos: [
            { etiqueta: "USDCOP", valor: 3.86 },
            { etiqueta: "USDCLP", valor: 0.92 },
            { etiqueta: "USDMXN", valor: 0.12 },
            { etiqueta: "USDARS", valor: -0.38 },
            { etiqueta: "USDPEN", valor: 0.41 },
            { etiqueta: "USDUYU", valor: 0.76 },
          ],
        },
        {
          nombre: "Índices",
          datos: [
            { etiqueta: "IPC MEX", valor: 0.56 },
            { etiqueta: "IBOVESPA", valor: -0.68 },
            { etiqueta: "MERVAL", valor: 5.05 },
            { etiqueta: "CHILE SLCT", valor: 0.81 },
            { etiqueta: "MSCI NUAM PERU", valor: 4.6 },
            { etiqueta: "COLOM COL", valor: -1.81 },
          ],
        },
      ],
      nota: "Variación semanal, en moneda local salvo pares de divisas.",
    },

    // ── Mercado Internacional ──────────────────────────────────────────────
    { tipo: "seccion", numero: "03", titulo: "Mercado internacional.", eyebrow: "El mundo" },
    { tipo: "subtitulo", titulo: "Estados Unidos" },
    {
      tipo: "parrafo",
      md: "Nvidia publicó resultados del primer trimestre fiscal superando las expectativas tanto en ingresos como en ganancias, y ofreció una guía para el segundo trimestre mejor de lo esperado. La compañía además anunció un programa de recompra de acciones por 80.000 millones de dólares y un pequeño aumento en su dividendo trimestral. A pesar de los buenos números, la acción cayó en la jornada posterior al reporte, evidenciando que el mercado ya tenía buena parte de las expectativas incorporadas en el precio.",
    },
    {
      tipo: "parrafo",
      md: "SpaceX presentó su prospecto S-1 ante la SEC, acercándose a lo que se espera sea uno de los mayores IPOs de la historia. La compañía de Elon Musk planea cotizar en el Nasdaq bajo el ticker SPCX, y anunció previamente un split de acciones de 5 a 1 para hacer más accesible el precio antes del debut bursátil. En el primer trimestre de 2026, SpaceX reportó ingresos consolidados de casi 4.700 millones de dólares.",
    },
    {
      tipo: "parrafo",
      md: "El mercado de renta fija fue el epicentro de la volatilidad semanal. El rendimiento del bono a 30 años tocó su nivel más alto desde 2007, en medio de una intensa venta de deuda soberana impulsada por el alza en los precios de la energía vinculada al conflicto con Irán. Al cierre del viernes, el rendimiento del bono a 10 años se ubicaba en torno al 4,56 %, mientras que el de 30 años rondaba el 5,07 %, con algo de alivio respecto a los picos de la semana.",
    },
    {
      tipo: "parrafo",
      md: "La guerra entre EE.UU. e Irán continuó siendo el telón de fondo de todos los mercados. El alza en los precios del petróleo por el conflicto fue el principal motor del repunte inflacionario. El jueves, los mercados rebotaron ante reportes de que podría estar acercándose un acuerdo mediado por Pakistán, aunque el Secretario de Estado Marco Rubio habló sólo de «algunas señales alentadoras».",
    },
    { tipo: "subtitulo", titulo: "Zona Euro" },
    {
      tipo: "parrafo",
      md: "El dato más impactante de la semana llegó el miércoles con los PMI flash de mayo. El PMI Compuesto de la Zona Euro cayó a 47,5 en mayo desde 48,8 en abril, muy por debajo de las expectativas del mercado de 48,8, marcando la contracción más aguda de la actividad privada desde octubre de 2023. El desglose es preocupante: el sector servicios se desplomó a 46,4 —su peor nivel en más de cinco años—, mientras que la manufactura, aunque más sólida, también se desaceleró a 51 desde 52,3 anterior. Los nuevos pedidos cayeron con fuerza en ambos sectores, los costos de insumos subieron al ritmo más alto en tres años, y las empresas redujeron el empleo por quinto mes consecutivo.",
    },
    { tipo: "subtitulo", titulo: "Japón" },
    {
      tipo: "parrafo",
      md: "El mercado de deuda soberana japonesa fue el epicentro de la tensión durante toda la semana. El rendimiento del bono japonés a 10 años se mantuvo en torno al 2,79 % el miércoles, su nivel más alto desde septiembre de 1996, impulsado por los sólidos datos de crecimiento y la preocupación por un shock inflacionario energético que alimenta las expectativas de una suba de tasas del Banco de Japón.",
    },
    { tipo: "subtitulo", titulo: "China" },
    {
      tipo: "parrafo",
      md: "China acordó comprar al menos 17.000 millones de dólares anuales de productos agrícolas estadounidenses hasta 2028, además de adquirir 200 aviones de Boeing, en el marco de los acuerdos alcanzados tras la cumbre entre Trump y Xi Jinping en Pekín la semana anterior. Las dos partes también acordaron crear un Consejo de Comercio y un Consejo de Inversión EE.UU. Sin embargo, el tono fue más de «reinicio diplomático» que de acuerdo transformador. La mención de reducciones arancelarias estuvo notablemente ausente del resumen de la Casa Blanca, y el propio Trump dijo a los periodistas que él y Xi no discutieron el tema arancelario en detalle. Los mercados interpretaron el resultado con cautela.",
    },
    {
      tipo: "retornos",
      titulo: "Retornos de la semana · global",
      grupos: [
        {
          nombre: "América",
          datos: [
            { etiqueta: "Dow Jones", valor: 2.2 },
            { etiqueta: "S&P 500", valor: 0.93 },
            { etiqueta: "Nasdaq 100", valor: 0.5 },
          ],
        },
        {
          nombre: "Europa",
          datos: [
            { etiqueta: "EuroStoxx 50", valor: 3.29 },
            { etiqueta: "FTSE 100", valor: 2.66 },
            { etiqueta: "CAC 40", valor: 2.05 },
            { etiqueta: "DAX", valor: 3.92 },
            { etiqueta: "IBEX", valor: 2.06 },
            { etiqueta: "MIB", valor: 0.8 },
            { etiqueta: "SMI", valor: 1.14 },
          ],
        },
        {
          nombre: "Asia",
          datos: [
            { etiqueta: "Nikkei", valor: 3.14 },
            { etiqueta: "Hang Seng", valor: -1.37 },
            { etiqueta: "Shenzhen", valor: -0.3 },
            { etiqueta: "ASX 200", valor: 0.3 },
          ],
        },
        {
          nombre: "Materias primas y monedas",
          datos: [
            { etiqueta: "BTC", valor: -1.25 },
            { etiqueta: "ETH", valor: -2.74 },
            { etiqueta: "Oro", valor: -0.35 },
            { etiqueta: "Plata", valor: -8.03 },
            { etiqueta: "EUR", valor: -0.11 },
            { etiqueta: "JPY", valor: -0.19 },
          ],
        },
      ],
      nota: "Variación semanal, en %.",
    },
  ],
};
