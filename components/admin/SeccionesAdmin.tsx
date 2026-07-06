"use client";

// Visibilidad de secciones: interruptores sobre los flags de vocabulario
// cerrado. El efecto llega al sitio vía los data-APIs (cache ≤5 min).

import { useCallback, useEffect, useState } from "react";
import { panelFetch, errorMessage, Card, Notice, Badge, PageHeader, Toggle } from "@/components/admin/ui";
import { fmtTs } from "@/components/admin/format";

type Flag = {
  key: string;
  label: string;
  descripcion: string;
  enabled: boolean;
  updatedAt: number | null;
  updatedBy: string | null;
};

export default function SeccionesAdmin() {
  const [flags, setFlags] = useState<Flag[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);

  const load = useCallback(async () => {
    const r = await panelFetch<{ flags: Flag[] }>("/api/admin/panel/flags");
    if (r.status === 200 && r.data?.flags) {
      setFlags(r.data.flags);
      setError(null);
    } else {
      setError(errorMessage(r));
    }
  }, []);

  useEffect(() => {
    // Diferido a microtask: el linter de React exige que ningún setState corra
    // sincrónico dentro del effect (load setea estado al resolver el fetch).
    queueMicrotask(() => void load());
  }, [load]);

  async function toggle(f: Flag) {
    if (busyKey) return;
    setBusyKey(f.key);
    setError(null);
    const r = await panelFetch(`/api/admin/panel/flags/${f.key}`, {
      method: "PATCH",
      body: JSON.stringify({ enabled: !f.enabled }),
    });
    if (r.status !== 200) setError(errorMessage(r));
    await load();
    setBusyKey(null);
  }

  return (
    <div>
      <PageHeader
        eyebrow="Panel · Sitio"
        title="Secciones del sitio"
        dek="Mostrar u ocultar módulos sin tocar código. El cambio tarda hasta 5 minutos en verse (cache del sitio)."
      />
      {error && (
        <div className="mb-4">
          <Notice kind="error">{error}</Notice>
        </div>
      )}
      {!flags ? (
        <p className="adm-help mt-0!">Cargando…</p>
      ) : (
        <div className="flex flex-col gap-3">
          {flags.map((f) => (
            <Card key={f.key}>
              <div className="flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="flex items-center gap-2 text-sm">
                    {f.label}
                    <Badge tone={f.enabled ? "pos" : "neu"}>{f.enabled ? "Visible" : "Oculta"}</Badge>
                  </p>
                  <p className="adm-help">{f.descripcion}</p>
                  {f.updatedAt && (
                    <p className="adm-help">
                      Último cambio: <span className="mono num">{fmtTs(f.updatedAt)}</span> · {f.updatedBy ?? "—"}
                    </p>
                  )}
                </div>
                <Toggle
                  checked={f.enabled}
                  disabled={busyKey === f.key}
                  onChange={() => toggle(f)}
                  label={`${f.enabled ? "Ocultar" : "Mostrar"} ${f.label}`}
                />
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
