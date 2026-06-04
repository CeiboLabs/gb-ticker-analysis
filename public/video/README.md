# Video de fondo del home

## Hero del home — montaje (instalado)

`hero-home.{mp4,webm}` es un montaje de 5 beats con crossfades, gradeado oscuro
con tinte navy para legibilidad y unidad de marca:

1. **WTC Montevideo aéreo** — toma drone de las torres del WTC (Buceo), de
   "Vista aérea World Trade Center MONTEVIDEO (4K)", canal **"Made in Uruguay"**
   (YouTube `GcUCg6gOylE`). **Uso autorizado por el creador** (permiso otorgado al
   cliente). Guardar la autorización por escrito en los registros de Bengochea.
   Ventana usada: 22.5–27.1s del original (segmento continuo, sin cortes).
   Bajado en 1440p (format 271) y downscaleado a 1080 para máxima nitidez.
2. **Molinos de viento (energía)** — Pexels (`...-32389489`), aérea de parque eólico
   sobre campos.
3. **Mega fábrica** — Pexels (`...-30715848`), nave industrial enorme con línea de producción.
4. **Agro** — Pexels (`...-31999665`), aérea de cosechadora en campo de soja.
5. **Puerto / logística aéreo** — Pexels (`...-32747083`).

(Beats 2 y 3 reemplazaron al asesor al teléfono y la oficina de broker; el 4 (agro) se sumó después.)

Loop sin costura (5 beats con crossfade de 0.7s; el último funde puerto→WTC y
empalma cuadro-a-cuadro con el inicio). Duración del loop: ~19.5s.

## Sección "Industrias" (instalado)

`ind/*.mp4` (+ `*-poster.jpg`) — loops de 6s usados en `components/institucional/Industrias.tsx`:

| archivo            | sector      | fuente Pexels (id)        |
|--------------------|-------------|---------------------------|
| `tecnologia.mp4`   | Tecnología  | server room (5028622)     |
| `energia.mp4`      | Energía     | molinos aéreos (10514722) |
| `agro.mp4`         | Agro        | cosechadora aérea (31914276) |
| `logistica.mp4`    | Logística   | puerto container aéreo (32747083) |

## Licencias

- **Pexels License** — uso comercial libre, sin atribución requerida. https://www.pexels.com/license/
- **Coverr License** — uso comercial libre, sin atribución requerida. https://coverr.co/license

Todos los clips se reprocesaron sin audio, recortados y optimizados para web.

---

El hero del home (`components/institucional/HeroInstitucional.tsx`) busca estos archivos.
Dejalos acá con estos nombres exactos:

- `hero-home.mp4`   ← obligatorio (compatibilidad universal: Safari/iOS/Android)
- `hero-home.webm`  ← opcional, recomendado (más liviano; el navegador lo prefiere si existe)
- `hero-home-poster.jpg` ← primer frame / imagen estática. Se ve mientras carga el video,
                           si el video falla, o si el usuario tiene "reduce motion" activado.

## Recomendaciones de encoding (fondo, mudo, en loop)

El video va silenciado y en loop detrás del texto, así que priorizá peso liviano:

- Duración: 12–25 s, con corte que loopee limpio.
- Resolución: 1920×1080 alcanza de sobra (el texto lo tapa parcialmente).
- Sin audio (se reproduce muted igual; sacar la pista ahorra peso).
- Apuntá a < 4–6 MB para el mp4.

Comandos ffmpeg (desde la carpeta donde tengas el original `fuente.mp4`):

```bash
# MP4 (H.264) optimizado para web, sin audio
ffmpeg -i fuente.mp4 -an -vf "scale=1920:-2" -c:v libx264 -crf 26 -preset slow \
  -movflags +faststart hero-home.mp4

# WebM (VP9), más liviano
ffmpeg -i fuente.mp4 -an -vf "scale=1920:-2" -c:v libvpx-vp9 -crf 34 -b:v 0 hero-home.webm

# Poster: tomar el primer frame
ffmpeg -i fuente.mp4 -vframes 1 -q:v 3 hero-home-poster.jpg
```

## Contenido sugerido

Tomas del WTC Montevideo (torres, fachada, drone), skyline de Montevideo / Puerto,
y planos genéricos de mercados / inversión (pantallas de cotizaciones, gráficos).
Mantener la paleta sobria (navy / dorado) coherente con la marca.
