// Contenido del centro educativo (/educacion): glosario, guías y preguntas
// frecuentes. Es material educativo GENÉRICO (definiciones de mercado), no
// afirmaciones institucionales sobre la casa — por eso se puede redactar sin
// insumo del cliente. Donde toca a la casa, se apoya en hechos verificables ya
// presentes en el sitio (regulación BCU, custodia segregada, plaza local +
// internacional, tarifario público). Estático a propósito: se edita en código.

// ── Glosario ─────────────────────────────────────────────────────────────────
export type GlosarioCategoria =
  | "Renta fija"
  | "Renta variable"
  | "Vehículos y conceptos"
  | "Operar en el mercado";

export type GlosarioTermino = {
  termino: string;
  definicion: string;
  categoria: GlosarioCategoria;
};

export const GLOSARIO: GlosarioTermino[] = [
  // Renta fija
  {
    termino: "Bono",
    categoria: "Renta fija",
    definicion:
      "Un título de deuda. Quien lo emite —un Estado o una empresa— toma prestado y se compromete a devolver el capital al vencimiento y a pagar intereses en el camino.",
  },
  {
    termino: "Cupón",
    categoria: "Renta fija",
    definicion:
      "El interés periódico que paga un bono, expresado como un porcentaje de su valor nominal.",
  },
  {
    termino: "TIR (Tasa Interna de Retorno)",
    categoria: "Renta fija",
    definicion:
      "El rendimiento anualizado que obtendría un inversor si mantiene el bono hasta el vencimiento, considerando su precio, sus cupones y su plazo.",
  },
  {
    termino: "Duration",
    categoria: "Renta fija",
    definicion:
      "Mide la sensibilidad del precio de un bono a cambios en las tasas de interés. A mayor duration, más se mueve el precio ante un cambio de tasa.",
  },
  {
    termino: "Obligación Negociable (ON)",
    categoria: "Renta fija",
    definicion:
      "Deuda emitida por una empresa privada bajo regulación local, que el inversor puede comprar y vender en el mercado.",
  },
  {
    termino: "Nota del Tesoro en UI",
    categoria: "Renta fija",
    definicion:
      "Título de deuda del Estado uruguayo denominado en Unidades Indexadas: ajusta por inflación, como cobertura del poder de compra.",
  },
  {
    termino: "Letra de Regulación Monetaria (LRM)",
    categoria: "Renta fija",
    definicion:
      "Instrumento de corto plazo en pesos emitido por el BCU. Se usa para colocar excedentes de liquidez a plazos breves.",
  },
  {
    termino: "Calificación crediticia",
    categoria: "Renta fija",
    definicion:
      "La nota que agencias especializadas le asignan a un emisor según su capacidad de pagar su deuda. A mejor nota, menor riesgo percibido.",
  },

  // Renta variable
  {
    termino: "Acción",
    categoria: "Renta variable",
    definicion:
      "Una parte del capital de una empresa. Quien la posee es dueño de una fracción y participa de sus resultados: la suba o baja del precio y, si los hay, los dividendos.",
  },
  {
    termino: "Dividendo",
    categoria: "Renta variable",
    definicion:
      "La parte de las ganancias que una empresa reparte entre sus accionistas.",
  },
  {
    termino: "Índice bursátil",
    categoria: "Renta variable",
    definicion:
      "Un indicador que resume el comportamiento de un conjunto de acciones — por ejemplo, el S&P 500 para las grandes empresas de Estados Unidos.",
  },

  // Vehículos y conceptos
  {
    termino: "Fondo de inversión",
    categoria: "Vehículos y conceptos",
    definicion:
      "Un vehículo que reúne el dinero de muchos inversores y lo administra de forma profesional según una estrategia definida. Cada inversor posee cuotas.",
  },
  {
    termino: "Valor cuota (NAV)",
    categoria: "Vehículos y conceptos",
    definicion:
      "El precio de una cuota de un fondo: el valor de todos sus activos dividido por la cantidad de cuotas. Se actualiza con cada valuación.",
  },
  {
    termino: "Benchmark",
    categoria: "Vehículos y conceptos",
    definicion:
      "La referencia contra la cual se compara el desempeño de una cartera o un fondo — por ejemplo, un índice de mercado.",
  },
  {
    termino: "Diversificación",
    categoria: "Vehículos y conceptos",
    definicion:
      "Repartir la inversión entre distintos activos, monedas o regiones para que un mal resultado puntual no comprometa el conjunto.",
  },
  {
    termino: "Riesgo país",
    categoria: "Vehículos y conceptos",
    definicion:
      "La sobretasa que paga la deuda de un país frente a la de referencia (Estados Unidos), como medida del riesgo percibido.",
  },

  // Operar en el mercado
  {
    termino: "Corredor de bolsa",
    categoria: "Operar en el mercado",
    definicion:
      "El intermediario autorizado y regulado —en Uruguay, por el Banco Central— para ejecutar operaciones de compraventa de valores por cuenta de sus clientes.",
  },
  {
    termino: "Custodia segregada",
    categoria: "Operar en el mercado",
    definicion:
      "Los valores del cliente se mantienen a su nombre y separados del patrimonio de la intermediaria: son del cliente, no nuestros.",
  },
  {
    termino: "Mercado primario y secundario",
    categoria: "Operar en el mercado",
    definicion:
      "En el primario se emiten los títulos por primera vez; en el secundario se compran y venden entre inversores.",
  },
  {
    termino: "Unidad Indexada (UI)",
    categoria: "Operar en el mercado",
    definicion:
      "Una unidad de valor uruguaya que se ajusta a diario por la inflación (IPC). Se usa en instrumentos que buscan preservar el poder de compra.",
  },
];

/** Orden canónico de las categorías del glosario. */
export const GLOSARIO_CATEGORIAS: GlosarioCategoria[] = [
  "Renta fija",
  "Renta variable",
  "Vehículos y conceptos",
  "Operar en el mercado",
];

// ── Guías ────────────────────────────────────────────────────────────────────
export type Guia = {
  titulo: string;
  /** Párrafos del cuerpo (uno por string). */
  cuerpo: string[];
};

export const GUIAS: Guia[] = [
  {
    titulo: "Cómo empezar a invertir",
    cuerpo: [
      "Antes que el monto, viene el objetivo. Para qué es la inversión, en qué plazo la vas a necesitar y cuánta oscilación estás dispuesto a tolerar en el camino: esas tres respuestas ordenan todo lo demás.",
      "Con eso claro, se abre una cuenta en una casa de bolsa regulada, se discute una propuesta a medida —qué se compra y por qué— y se ejecuta con la cartera a tu nombre. Después viene el seguimiento: revisar y ajustar cuando cambia el contexto o cambian tus objetivos.",
    ],
  },
  {
    titulo: "Renta fija o renta variable",
    cuerpo: [
      "La renta fija —bonos, letras, notas— busca previsibilidad: si mantenés el título hasta el vencimiento, conocés de antemano el flujo que vas a recibir. La renta variable —acciones— busca crecimiento, a cambio de mayor oscilación en el precio.",
      "No es una elección de una u otra. La mayoría de las carteras combina ambas en la proporción que corresponda al objetivo y al horizonte de cada inversor.",
    ],
  },
  {
    titulo: "Cómo leer un informe de mercado",
    cuerpo: [
      "Un informe de mercado ordena tres capas: el contexto macro (crecimiento, inflación, tasas), los movimientos de la plaza local e internacional en el período, y las lecturas que se desprenden de todo eso.",
      "No es una recomendación personalizada: es la lectura general de la mesa. Sirve para entender el terreno; la decisión sobre tu cartera siempre requiere una conversación.",
    ],
  },
];

// ── Preguntas frecuentes ─────────────────────────────────────────────────────
export type FaqEducacion = { pregunta: string; respuesta: string };

export const FAQ_EDUCACION: FaqEducacion[] = [
  {
    pregunta: "¿Necesito un capital grande para empezar?",
    respuesta:
      "No hay un único mínimo: depende de los instrumentos. Lo importante es definir el objetivo antes que el monto. La mejor forma de saber por dónde empezar es conversarlo con la mesa.",
  },
  {
    pregunta: "¿En qué se diferencia una casa de bolsa de un banco?",
    respuesta:
      "Una casa de bolsa —corredor de bolsa— intermedia la compra y venta de valores en el mercado por cuenta del cliente. No es un banco ni toma depósitos. En Uruguay está regulada por el Banco Central.",
  },
  {
    pregunta: "¿Las inversiones quedan a mi nombre?",
    respuesta:
      "Sí. Bajo custodia segregada, los valores se mantienen a nombre del cliente y separados de nuestro patrimonio.",
  },
  {
    pregunta: "¿Puedo invertir en el exterior desde Uruguay?",
    respuesta:
      "Sí. Desde la mesa local se accede tanto a la plaza uruguaya como a los mercados internacionales, con la cuenta a nombre del cliente y custodia regulada.",
  },
  {
    pregunta: "¿Qué costos tiene invertir?",
    respuesta:
      "Las comisiones están publicadas en nuestro tarifario. La estructura se explica antes de operar, en lenguaje claro: sin sorpresas en la primera liquidación.",
  },
];
