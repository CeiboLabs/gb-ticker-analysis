// Fuente única de los informes publicados. La lista (/informes) y la página de
// cada informe (/informes/[slug]) consumen estos datos. El PDF vive en
// gbengochea.com.uy; lo servimos a través de un proxy same-origin
// (/informes/[slug]/pdf) porque el host original manda X-Frame-Options:SAMEORIGIN
// y nuestro propio CSP bloquea iframes/objects de terceros.

export type Informe = {
  /** Identificador estable en la URL: /informes/<slug> */
  slug: string;
  /** ISO date para ordenar */
  fecha: string;
  fechaTexto: string;
  titulo: string;
  categoria: "Mensual" | "Semanal";
  /** URL absoluta del PDF en el host del cliente */
  pdf: string;
};

export const INFORMES: Informe[] = [
  {
    slug: "semanal-2026-05-29",
    fecha: "2026-05-29",
    fechaTexto: "29 de mayo, 2026",
    titulo: "Informe semanal · 29 de mayo",
    categoria: "Semanal",
    pdf: "https://gbengochea.com.uy/img/informes/GB INFORME SEMANAL 29-05-2026.pdf",
  },
  {
    slug: "semanal-2026-05-22",
    fecha: "2026-05-22",
    fechaTexto: "22 de mayo, 2026",
    titulo: "Informe semanal · 22 de mayo",
    categoria: "Semanal",
    pdf: "https://gbengochea.com.uy/img/informes/GB INFORME SEMANAL 22-05-2026.pdf",
  },
  {
    slug: "mensual-2026-05",
    fecha: "2026-05-18",
    fechaTexto: "18 de mayo, 2026",
    titulo: "Informe mensual · Mayo 2026",
    categoria: "Mensual",
    pdf: "https://gbengochea.com.uy/img/informes/Bengochea Inversiones - Informe mensual Mayo 2026.pdf",
  },
  {
    slug: "semanal-2026-05-15",
    fecha: "2026-05-15",
    fechaTexto: "15 de mayo, 2026",
    titulo: "Informe semanal · 15 de mayo",
    categoria: "Semanal",
    pdf: "https://gbengochea.com.uy/img/informes/GB INFORME SEMANAL 15-05-2026.pdf",
  },
  {
    slug: "semanal-2026-05-11",
    fecha: "2026-05-11",
    fechaTexto: "11 de mayo, 2026",
    titulo: "Informe semanal · 11 de mayo",
    categoria: "Semanal",
    pdf: "https://gbengochea.com.uy/img/informes/GB INFORME SEMANAL 11-05-2026.pdf",
  },
  {
    slug: "semanal-2026-04-24",
    fecha: "2026-04-24",
    fechaTexto: "24 de abril, 2026",
    titulo: "Informe semanal · 24 de abril",
    categoria: "Semanal",
    pdf: "https://gbengochea.com.uy/img/informes/GB INFORME SEMANAL 24-04-2026.pdf",
  },
  {
    slug: "semanal-2026-04-20",
    fecha: "2026-04-20",
    fechaTexto: "20 de abril, 2026",
    titulo: "Informe semanal · 20 de abril",
    categoria: "Semanal",
    pdf: "https://gbengochea.com.uy/img/informes/GB INFORME SEMANAL 20-04-2026.pdf",
  },
];

export function getInforme(slug: string): Informe | undefined {
  return INFORMES.find((i) => i.slug === slug);
}

export type Autor = {
  nombre: string;
  cadencia: string;
  tag: "Mensual" | "Semanal";
  /** Path al retrato en /public; "" si todavía no hay foto */
  foto: string;
  bio: string;
};

// NOTA: bios placeholder — reemplazar por la versión definitiva del cliente.
// Falta el retrato de Paula Bujia: dejar el archivo en public/equipo/paula-bujia.jpg
export const AUTORES: Autor[] = [
  {
    nombre: "Paula Bujia",
    cadencia: "Informes mensuales",
    tag: "Mensual",
    // Sin retrato todavía: dejar el archivo en public/equipo/paula-bujia.jpg
    // y completar el path para que reemplace el placeholder.
    foto: "",
    bio:
      "Lidera el informe mensual: la visión macro internacional, la lectura de la renta fija uruguaya y el posicionamiento de cartera que ordena el mes en la mesa.",
  },
  {
    nombre: "Adrián Moreira",
    cadencia: "Informes semanales",
    tag: "Semanal",
    foto: "/equipo/adrian-moreira.jpeg",
    bio:
      "Desde la mesa de operaciones firma el informe semanal: el seguimiento de cada cierre de mercado y los movimientos relevantes de la semana en las plazas locales e internacionales.",
  },
];
