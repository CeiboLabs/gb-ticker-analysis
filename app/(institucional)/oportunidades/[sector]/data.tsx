import type { ReactNode } from "react";
import {
  TrendingUp,
  Layers,
  Certificate,
  Lock,
  Building,
} from "@/components/institucional/icons";

/* ──────────────────────────────────────────────────────────────
   Dossiers de sector — research editorial, no asesoramiento.
   Una sola fuente de verdad para /oportunidades/[sector].
   Las claves coinciden con components/institucional/Industrias.tsx
   y con los posters en /public/video/ind/.

   Criterio de contenido (marca Bengochea):
   - Punto de vista propio ("la mesa"), tono institucional, sustancia.
   - Tipos de vehículo y mapa del sector, nunca tickers ni señales.
   - Sin cifras inventadas: la ficha es cualitativa y verificable.
   ────────────────────────────────────────────────────────────── */

export type Driver = { title: string; body: string };
export type Segmento = { name: string; body: string };
export type Vehiculo = { icon: ReactNode; title: string; body: string };

export type Sector = {
  slug: string;
  label: string;
  /** Índice del dossier, ej. "01". */
  num: string;
  /** Poster del clip de la home, reutilizado como imagen del dossier. */
  hero: string;
  title: string;
  /** Standfirst en serif. */
  standfirst: string;
  /** Ficha cualitativa: [etiqueta, valor]. */
  ficha: [string, string][];
  tesis: { dek: string; paras: string[]; quote: string };
  drivers: { dek: string; items: Driver[] };
  segmentos: { dek: string; items: Segmento[] };
  vehiculos: { dek: string; items: Vehiculo[] };
  consideraciones: { dek: string; items: Driver[] };
};

const TOTAL = 4;
export const SECTOR_TOTAL = TOTAL;

export const SECTORES: Record<string, Sector> = {
  tecnologia: {
    slug: "tecnologia",
    label: "Tecnología",
    num: "01",
    hero: "/video/ind/tecnologia-poster.jpg",
    title: "El sector que reescribe la economía global.",
    standfirst:
      "Semiconductores, software y la infraestructura de datos que sostiene a todo lo demás. Desde Montevideo accedés a las compañías que fijan el ritmo de la innovación mundial.",
    ficha: [
      ["Horizonte", "Largo plazo"],
      ["Perfil de retorno", "Crecimiento"],
      ["Acceso", "Acciones EE. UU."],
      ["Moneda base", "Dólares"],
    ],
    tesis: {
      dek: "Por qué un inversor de largo plazo mira a la tecnología.",
      paras: [
        "La tecnología dejó de ser un sector para volverse la capa sobre la que opera el resto de la economía. El software se cobra por suscripción y genera ingresos recurrentes; los semiconductores son el insumo crítico de cualquier producto con valor agregado; los datos y la inteligencia artificial agregan una nueva fuente de demanda sobre el cómputo y la energía.",
        "Para el inversor, eso se traduce en compañías con márgenes altos, posiciones competitivas difíciles de replicar y un mercado direccionable que crece con cada usuario y cada dispositivo conectado. El precio de esa calidad es la volatilidad: las expectativas son altas y el mercado las revisa sin piedad.",
      ],
      quote:
        "No invertimos en tecnología por la novedad, sino por la durabilidad del flujo de caja que genera. La moda pasa; la infraestructura crítica, no.",
    },
    drivers: {
      dek: "Cuatro fuerzas estructurales que sostienen el crecimiento de largo plazo del sector.",
      items: [
        { title: "Semiconductores", body: "El insumo crítico de la economía digital. Diseño, fabricación y equipamiento concentrados en pocas compañías de escala global con barreras de entrada enormes." },
        { title: "Software y nube", body: "Ingresos recurrentes y márgenes altos. La migración a la nube sigue siendo un cambio estructural de fondo, no un ciclo pasajero." },
        { title: "Inteligencia artificial", body: "Una nueva capa de demanda sobre cómputo, datos y energía que atraviesa, directa o indirectamente, a casi todas las industrias." },
        { title: "Conectividad", body: "Redes, dispositivos y plataformas que expanden el mercado direccionable con cada nuevo usuario que se incorpora al mundo digital." },
      ],
    },
    segmentos: {
      dek: "El sector no es monolítico. Estos son los subsegmentos donde se concentra el valor invertible.",
      items: [
        { name: "Diseño de chips", body: "Compañías que diseñan los procesadores y aceleradores que mueven la IA y el cómputo moderno." },
        { name: "Fabricación y equipamiento", body: "Las fundiciones y los fabricantes de las máquinas que hacen posible producir cada nueva generación de chips." },
        { name: "Software de infraestructura", body: "Nube, bases de datos y herramientas sobre las que se construye el resto del software del mundo." },
        { name: "Plataformas digitales", body: "Negocios de red con escala global: buscadores, publicidad, comercio y sistemas operativos." },
        { name: "Ciberseguridad", body: "Un gasto que crece de forma estructural a medida que más actividad económica se vuelve digital." },
      ],
    },
    vehiculos: {
      dek: "Distintos instrumentos para tomar exposición, según objetivo, horizonte y tolerancia al riesgo. La selección se define en la mesa.",
      items: [
        { icon: <TrendingUp />, title: "Acciones globales", body: "Posiciones en compañías listadas en Estados Unidos y otros mercados, operadas desde la mesa local." },
        { icon: <Layers />, title: "ETFs sectoriales", body: "Exposición diversificada al sector o a subsegmentos (semis, software) en un solo instrumento." },
        { icon: <Certificate />, title: "Renta fija corporativa", body: "Deuda de compañías tecnológicas, para quien busca el sector con un perfil de riesgo más conservador." },
        { icon: <Lock />, title: "Fondos gestionados", body: "Vehículos de managers globales especializados, para delegar la selección dentro del sector." },
      ],
    },
    consideraciones: {
      dek: "El sector ofrece crecimiento, pero no está libre de riesgo. Esto es lo que ponemos sobre la mesa antes de tomar una posición.",
      items: [
        { title: "Volatilidad y valuación", body: "Las expectativas de crecimiento elevan los múltiplos: las correcciones pueden ser fuertes y rápidas." },
        { title: "Concentración", body: "Una porción grande del valor descansa en pocas compañías. La diversificación importa más de lo que parece." },
        { title: "Horizonte", body: "Es exposición de largo plazo. El ciclo de la innovación premia la paciencia, no el timing." },
      ],
    },
  },

  energia: {
    slug: "energia",
    label: "Energía",
    num: "02",
    hero: "/video/ind/energia-poster.jpg",
    title: "El sector que alimenta a la economía global.",
    standfirst:
      "Renovables, petróleo y gas conviven en una transición que llevará décadas. Desde Montevideo accedés tanto a la energía que mueve hoy al mundo como a la que lo moverá mañana.",
    ficha: [
      ["Horizonte", "Largo plazo"],
      ["Perfil de retorno", "Crecimiento y renta"],
      ["Acceso", "Bolsas globales"],
      ["Moneda base", "Dólares"],
    ],
    tesis: {
      dek: "Por qué la energía sigue siendo una asignación central.",
      paras: [
        "La energía combina dos cosas que rara vez van juntas: una demanda de base estable y previsible, y una transformación estructural en marcha. El mundo seguirá necesitando petróleo y gas durante décadas, mientras invierte cantidades enormes en renovables, redes y almacenamiento. Las dos realidades conviven y ambas son invertibles.",
        "Para el inversor, eso significa poder elegir el perfil: las integradas tradicionales generan flujo de caja y dividendos; la transición ofrece crecimiento de largo plazo respaldado por política pública global. El riesgo está en el precio de las materias primas y en la regulación, dos variables fuera del control de cualquier compañía.",
      ],
      quote:
        "La transición energética no es una apuesta binaria. Se invierte en las dos curvas a la vez, ponderando según el perfil de cada cliente.",
    },
    drivers: {
      dek: "La energía une una demanda de base estable con una transformación estructural en marcha.",
      items: [
        { title: "Transición energética", body: "Inversión sostenida en renovables, redes y almacenamiento. Un cambio de largo plazo respaldado por política pública a escala global." },
        { title: "Petróleo y gas", body: "Siguen siendo la base de la matriz energética mundial y generan flujos de caja y dividendos relevantes." },
        { title: "Infraestructura", body: "Ductos, transporte y distribución: activos con ingresos regulados y previsibles a través del ciclo." },
        { title: "Demanda eléctrica", body: "Electrificación, centros de datos e IA empujan un consumo eléctrico que vuelve a acelerar tras años de estancamiento." },
      ],
    },
    segmentos: {
      dek: "Distintos eslabones de la cadena energética, con lógicas de retorno diferentes.",
      items: [
        { name: "Integradas de petróleo y gas", body: "Grandes compañías que exploran, producen y refinan, históricamente generadoras de dividendos." },
        { name: "Energía limpia", body: "Solar, eólica y compañías de tecnología limpia, el corazón de la transición." },
        { name: "Utilities", body: "Generación y distribución eléctrica regulada, con ingresos estables y defensivos." },
        { name: "Infraestructura y midstream", body: "Ductos y transporte de energía, con contratos de largo plazo e ingresos previsibles." },
        { name: "Almacenamiento y redes", body: "Baterías y modernización de la red: el cuello de botella que la transición necesita resolver." },
      ],
    },
    vehiculos: {
      dek: "El sector se puede tomar por crecimiento, por renta o por ambos. El vehículo se elige según ese objetivo.",
      items: [
        { icon: <TrendingUp />, title: "Acciones globales", body: "Integradas de petróleo y gas, utilities y compañías de energía limpia listadas en las principales plazas." },
        { icon: <Layers />, title: "ETFs sectoriales", body: "Exposición amplia al sector tradicional o específica a renovables y energía limpia." },
        { icon: <Certificate />, title: "Renta fija corporativa", body: "Deuda de compañías energéticas, históricamente generadoras de flujo, para perfiles que priorizan renta." },
        { icon: <Building />, title: "Infraestructura y fondos", body: "Vehículos enfocados en activos de infraestructura energética con ingresos regulados." },
      ],
    },
    consideraciones: {
      dek: "Es un sector cíclico y sensible al precio de las materias primas. Esto es lo que evaluamos antes de entrar.",
      items: [
        { title: "Ciclo de commodities", body: "El resultado depende en buena parte del precio del crudo y del gas, fuera del control de cualquier compañía." },
        { title: "Riesgo regulatorio", body: "La política energética y ambiental mueve el valor del sector tanto como la demanda." },
        { title: "Dos velocidades", body: "Energía tradicional y transición responden a lógicas distintas: conviene definir a cuál se busca exposición." },
      ],
    },
  },

  agro: {
    slug: "agro",
    label: "Agro",
    num: "03",
    hero: "/video/ind/agro-poster.jpg",
    title: "El corazón productivo de la región, como inversión.",
    standfirst:
      "Alimentos, commodities y la cadena que los lleva al mundo. Desde Uruguay, un país agroexportador, accedés a un sector que conocemos de cerca y que mueve a la economía global.",
    ficha: [
      ["Horizonte", "Largo plazo"],
      ["Perfil de retorno", "Cíclico"],
      ["Acceso", "Plaza local · Global"],
      ["Moneda base", "Dólares · UI"],
    ],
    tesis: {
      dek: "Por qué el agro merece un lugar en una cartera diversificada.",
      paras: [
        "El agro tiene una virtud que pocos sectores comparten: su demanda de fondo es prácticamente inelástica. La población crece y consume más proteína y granos, sin importar el ciclo económico. Sobre esa base estable operan palancas de productividad —semillas, tecnología, datos— que elevan el rendimiento por hectárea año tras año.",
        "Desde Uruguay, además, es un sector que se entiende de cerca. La inversión no se limita a producir: trading, procesamiento y logística agregan valor entre el campo y la góndola. El costado a vigilar es la dependencia del precio internacional y del clima, dos variables que ninguna compañía controla.",
      ],
      quote:
        "Es el sector que mejor conocemos como país. Esa cercanía no es un detalle de color: es ventaja de información a la hora de invertir.",
    },
    drivers: {
      dek: "El agro combina una demanda inelástica de fondo con palancas de productividad y tecnología.",
      items: [
        { title: "Demanda de alimentos", body: "Población y consumo en ascenso sostienen una demanda estructural de proteína y granos a largo plazo." },
        { title: "Commodities agrícolas", body: "Granos, oleaginosas y proteína animal: precios globales que conectan al campo regional con el mundo." },
        { title: "Agtech e insumos", body: "Semillas, fertilizantes, maquinaria y datos que elevan el rendimiento por hectárea año tras año." },
        { title: "Cadena de valor", body: "Trading, procesamiento y logística agregan valor entre el productor y la góndola." },
      ],
    },
    segmentos: {
      dek: "El agronegocio es una cadena larga. Cada eslabón es una forma distinta de tomar exposición.",
      items: [
        { name: "Insumos y semillas", body: "Compañías de fertilizantes, agroquímicos y genética que habilitan la productividad del campo." },
        { name: "Maquinaria agrícola", body: "Fabricantes de equipos, cada vez más cargados de tecnología y datos." },
        { name: "Trading de granos", body: "Las grandes comercializadoras que mueven los commodities agrícolas por el mundo." },
        { name: "Procesamiento de alimentos", body: "Compañías que transforman la materia prima en producto de mayor valor agregado." },
        { name: "Tierra y producción", body: "Vehículos con exposición directa al activo productivo y a la zafra." },
      ],
    },
    vehiculos: {
      dek: "Desde la plaza local y la internacional, distintos caminos para tomar exposición al agro.",
      items: [
        { icon: <TrendingUp />, title: "Acciones globales", body: "Compañías de insumos, maquinaria, trading y procesamiento de alimentos listadas en plazas internacionales." },
        { icon: <Layers />, title: "ETFs y commodities", body: "Exposición a canastas agrícolas o a compañías del agronegocio en un solo instrumento diversificado." },
        { icon: <Certificate />, title: "Obligaciones Negociables", body: "Deuda corporativa local de empresas del agro uruguayo, bajo regulación del Banco Central del Uruguay." },
        { icon: <Lock />, title: "Fideicomisos y fondos", body: "Vehículos locales e internacionales que canalizan inversión hacia proyectos del sector." },
      ],
    },
    consideraciones: {
      dek: "El agro es tangible y conocido, pero no por eso menos cíclico. Esto es lo que ponemos sobre la mesa.",
      items: [
        { title: "Precio y clima", body: "Los resultados dependen de variables fuera de control: cotizaciones internacionales y condiciones climáticas." },
        { title: "Ciclo y estacionalidad", body: "El negocio tiene zafras y ciclos. La lectura del momento del ciclo es parte de la decisión." },
        { title: "Horizonte productivo", body: "Es un sector de tiempos productivos reales: la exposición rinde mejor con paciencia." },
      ],
    },
  },

  logistica: {
    slug: "logistica",
    label: "Logística",
    num: "04",
    hero: "/video/ind/logistica-poster.jpg",
    title: "Las cadenas que conectan a los mercados.",
    standfirst:
      "Puertos, navieras y comercio: la infraestructura silenciosa que mueve todo lo que se produce. Desde Montevideo accedés a las compañías que sostienen el comercio global.",
    ficha: [
      ["Horizonte", "Mediano y largo plazo"],
      ["Perfil de retorno", "Cíclico y renta"],
      ["Acceso", "Bolsas globales"],
      ["Moneda base", "Dólares"],
    ],
    tesis: {
      dek: "Por qué la logística es una forma elegante de invertir en el comercio mundial.",
      paras: [
        "La logística es el sistema circulatorio de la economía: cuando el comercio crece, crece con él. Es una manera de tomar exposición a la actividad global sin apostar a un solo producto o región, porque todo lo que se produce necesita moverse, almacenarse y distribuirse.",
        "El sector mezcla compañías operadoras —navieras, ferroviarias, couriers— con activos de infraestructura real, como puertos y centros de distribución, que generan renta estable por alquiler. El reverso es su sensibilidad al ciclo: los volúmenes y, sobre todo, las tarifas, pueden oscilar con fuerza en plazos cortos.",
      ],
      quote:
        "Invertir en logística es invertir en el comercio mismo, no en una empresa o un país en particular. Es exposición a un sistema, no a una apuesta.",
    },
    drivers: {
      dek: "La logística es el sistema circulatorio de la economía: cuando el comercio crece, crece con él.",
      items: [
        { title: "Comercio global", body: "El intercambio de bienes entre regiones sostiene la demanda de transporte marítimo, terrestre y aéreo." },
        { title: "Cadenas de suministro", body: "La reconfiguración del comercio mundial reordena rutas, hubs y operadores logísticos." },
        { title: "E-commerce y última milla", body: "El comercio electrónico multiplica los envíos y eleva la demanda de capacidad de distribución." },
        { title: "Activos de infraestructura", body: "Puertos, depósitos y centros de distribución: activos reales con ingresos estables y de largo plazo." },
      ],
    },
    segmentos: {
      dek: "El sector combina operadores con activos de infraestructura. Cada uno tiene su lógica de retorno.",
      items: [
        { name: "Transporte marítimo", body: "Navieras y portacontenedores, el modo que mueve la mayor parte del comercio mundial." },
        { name: "Ferrocarril y terrestre", body: "Operadores con redes difíciles de replicar y posiciones competitivas duraderas." },
        { name: "Courier y paquetería", body: "Las compañías que sostienen la última milla del comercio electrónico." },
        { name: "Puertos y terminales", body: "Activos de infraestructura crítica con ingresos de largo plazo." },
        { name: "Depósitos y REITs industriales", body: "Centros de distribución que cobran renta por alquiler, con foco en flujo estable." },
      ],
    },
    vehiculos: {
      dek: "El sector combina compañías operadoras con activos de infraestructura. Cada uno tiene su vehículo.",
      items: [
        { icon: <TrendingUp />, title: "Acciones globales", body: "Navieras, ferroviarias, courier y operadores logísticos listados en las principales plazas internacionales." },
        { icon: <Layers />, title: "ETFs sectoriales", body: "Exposición diversificada al transporte y la logística global en un solo instrumento." },
        { icon: <Building />, title: "REITs industriales", body: "Vehículos que invierten en depósitos y centros de distribución, con foco en renta por alquiler." },
        { icon: <Certificate />, title: "Renta fija corporativa", body: "Deuda de compañías de transporte e infraestructura, para perfiles orientados a la renta." },
      ],
    },
    consideraciones: {
      dek: "La logística sigue de cerca al ciclo económico. Esto es lo que evaluamos antes de tomar exposición.",
      items: [
        { title: "Sensibilidad al ciclo", body: "Los volúmenes y las tarifas suben y bajan con la actividad económica global." },
        { title: "Tarifas volátiles", body: "El transporte marítimo puede tener oscilaciones de tarifas muy pronunciadas en plazos cortos." },
        { title: "Geopolítica", body: "Rutas, aranceles y conflictos redibujan el mapa logístico y afectan a los operadores." },
      ],
    },
  },
};

export const SECTOR_SLUGS = Object.keys(SECTORES);
