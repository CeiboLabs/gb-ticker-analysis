// Cache con vencimiento, en memoria del proceso, para respuestas de upstream.
//
// Existe porque los headers `Cache-Control: s-maxage=…` que declaran las rutas
// sólo valen si hay una cache compartida adelante. En Cloudflare la había; en el
// home server (next start detrás del funnel) no hay nada que los respete, así
// que cada visita golpeaba Yahoo de nuevo. Medido en /analisis: dos llamadas por
// carga de la landing, ~1,9 s de trabajo aguas arriba, todas las veces.
//
// Además de la cache hay deduplicación de pedidos EN VUELO: diez visitas
// simultáneas con la cache fría comparten una sola llamada, en vez de disparar
// diez contra un upstream que además está limitado a 1 req/s.
//
// Deliberadamente NO cachea los errores: si el productor falla, el rechazo llega
// a todos los que estaban esperando y la próxima visita reintenta.

type Entry<T> = { value: T; at: number };

export function createTtlMemo<T>(defaultTtlMs: number, max = 64) {
  const store = new Map<string, Entry<T>>();
  const inflight = new Map<string, Promise<T>>();

  // Se poda al escribir: primero lo vencido y, si aún sobra, lo más viejo (Map
  // conserva el orden de inserción). Sin esto, un cache por (ticker, rango)
  // crecería sin techo con cada símbolo que alguien mire.
  function prune(ttlMs: number): void {
    if (store.size <= max) return;
    const now = Date.now();
    for (const [k, e] of store) if (now - e.at >= ttlMs) store.delete(k);
    while (store.size > max) {
      const oldest = store.keys().next();
      if (oldest.done) break;
      store.delete(oldest.value);
    }
  }

  return function memo(key: string, produce: () => Promise<T>, ttlMs = defaultTtlMs): Promise<T> {
    const hit = store.get(key);
    if (hit && Date.now() - hit.at < ttlMs) return Promise.resolve(hit.value);

    const pending = inflight.get(key);
    if (pending) return pending;

    const task = produce().then((value) => {
      store.set(key, { value, at: Date.now() });
      prune(ttlMs);
      return value;
    });
    inflight.set(key, task);
    // El .catch() de acá es sólo para no dejar un rechazo sin manejar mientras
    // se limpia el registro; el rechazo original sigue viajando al llamador.
    void task.catch(() => {}).finally(() => inflight.delete(key));

    return task;
  };
}
