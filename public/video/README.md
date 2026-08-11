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
ffmpeg -i fuente.mp4 -an -vf "scale=1920:-2" -c:v libx264 -crf 34 -preset slow \
  -profile:v high -pix_fmt yuv420p -movflags +faststart hero-home.mp4

# WebM (VP9) — DOS PASADAS con bitrate objetivo, no CRF (ver abajo)
ffmpeg -i fuente.mp4 -an -c:v libvpx-vp9 -b:v 1900k -pass 1 -row-mt 1 -cpu-used 3 -f null /dev/null
ffmpeg -i fuente.mp4 -an -c:v libvpx-vp9 -b:v 1900k -pass 2 -row-mt 1 -cpu-used 1 hero-home.webm

# Poster: tomar el primer frame
ffmpeg -i fuente.mp4 -vframes 1 -q:v 3 hero-home-poster.jpg
```

### Por qué estos números (medido 2026-08-05, montaje actual)

La receta anterior (`-crf 26` para H.264 y `-crf 34 -b:v 0` para VP9) daba
**12,7 MB de mp4 y 11,3 MB de webm** — muy por encima del "< 4–6 MB" que pide
este mismo documento, y el webm es el que efectivamente descargan Chrome y
Firefox. Medido contra el master, con SSIM:

| encoding | peso | SSIM |
|---|---|---|
| webm viejo (VP9 CRF, 1 pasada) | 11,26 MB | 0,925 |
| **webm nuevo (VP9 2-pass 1900k)** | **4,44 MB** | 0,916 |
| mp4 viejo (H.264 CRF 26) | 12,74 MB | — (es la referencia) |
| **mp4 nuevo (H.264 CRF 34 slow)** | **4,36 MB** | **0,935** |

Dos cosas que valen para la próxima vez:

- **VP9 en modo CRF no rinde con este material** (aéreas con mucho detalle en
  movimiento): a CRF 36 daba 12,5 MB y a CRF 40 todavía 10,7 MB. Con dos pasadas
  y bitrate objetivo baja a 4,4 MB con prácticamente la misma calidad. Para VP9,
  2-pass es el camino.
- **El mp4 nuevo a 4,36 MB tiene MÁS calidad (0,935) que el webm viejo de 11,26 MB
  (0,925)**: el webm estaba mal encodeado, gastaba el triple para menos.

Al reencodear, verificar que el frame count y la duración no cambien (586 frames
/ 19,533 s): el loop empalma **cuadro a cuadro** con su propio inicio y un frame
de más o de menos se ve como un salto.

## Contenido sugerido

Tomas del WTC Montevideo (torres, fachada, drone), skyline de Montevideo / Puerto,
y planos genéricos de mercados / inversión (pantallas de cotizaciones, gráficos).
Mantener la paleta sobria (navy / dorado) coherente con la marca.
