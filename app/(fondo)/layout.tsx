import { LenisProvider } from "@/components/LenisProvider";
import { NavbarFondo } from "@/components/institucional/NavbarFondo";
import { FooterFondo } from "@/components/institucional/FooterFondo";
import { MedicionFondo } from "@/components/institucional/MedicionFondo";
import { ConsentimientoFondo } from "@/components/institucional/ConsentimientoFondo";
import { baseFondoServer, origenCasaServer } from "@/lib/sitiosServer";

/**
 * Cáscara del SITIO DEL FONDO — el otro sitio de la casa (ver `lib/sitios.ts`).
 *
 * Este route group es lo que hace que el fondo sea un sitio y no una sección: su
 * navbar y su pie son propios, no los de `app/(institucional)`. El dominio lo
 * resuelve `next.config.ts` por Host; la cáscara la resuelve este archivo.
 *
 * Qué NO trae, y por qué:
 *   · el `Navbar` mega-panel de la casa — es el mapa de OTRO sitio;
 *   · `PageTransitions` — es una cortina para navegación entre páginas, y este
 *     sitio tiene una sola: no habría transición que animar, y sus links salen a
 *     otro origen, que el interceptor no toca de todas formas.
 * Sí trae Lenis: el scroll suave es parte del lenguaje de la casa, y esta página
 * es de 13.000 px con anclas — es justamente donde más se nota.
 *
 * ⚠️ En el build COMPARTIDO este subárbol se renderiza POR REQUEST: el origen de
 * la casa sale del `Host`, porque los links al sitio institucional tienen que ser
 * absolutos cuando el request entró por el dominio del fondo y relativos cuando
 * los dos sitios comparten hostname (el dev y el home server, que se publica por
 * Tailscale con un solo nombre). Congelar eso en build dejaría a staging —justo
 * donde revisa el cliente— con links al dominio de producción.
 *
 * En el build STANDALONE del fondo no hay más que un dominio que servir, no se
 * mira el request y la página queda PRERENDERIZABLE — que es lo que permite
 * servirla como HTML estático desde el borde, sin invocar worker. La bifurcación
 * entera vive en `origenCasaServer` (lib/sitiosServer.ts).
 *
 * En los dos casos este render NO consulta la base: los datos vivos de la página
 * —valor cuota, tenencias, documentos— ya los pide el cliente por API.
 */
export default async function FondoLayout({ children }: { children: React.ReactNode }) {
  const casa = await origenCasaServer();
  // Prefijo de los links INTERNOS del sitio del fondo. Vacío en su propio
  // dominio —donde el sitio cuelga de la raíz— y `/bng-seleccion-global` donde
  // los dos sitios comparten hostname. Ver `baseFondo` en lib/sitios.ts.
  const base = await baseFondoServer();

  return (
    <LenisProvider>
      {/* Primero de todo: la medición sólo existe si llega temprano. Vive en la
          cáscara del FONDO y no en el layout raíz porque es el único de los tres
          sitios que tiene contenedor — ver lib/medicion.ts. */}
      <MedicionFondo />
      {/* Arriba en el DOM aunque flote abajo en pantalla: es un diálogo que pide
          una decisión, y con el teclado tiene que llegarse antes que al sitio. */}
      <ConsentimientoFondo politica={`${base}/cookies`} />
      <NavbarFondo casa={casa} />
      {children}
      <FooterFondo base={base} />
    </LenisProvider>
  );
}
