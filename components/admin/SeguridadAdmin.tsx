"use client";

// «Mi seguridad»: cambio de contraseña self-service (exige la actual + el
// código TOTP) y las sesiones vivas de la cuenta, con botón para cerrar las
// demás. El reset del segundo factor propio lo hace OTRO admin, no uno mismo.

import { useCallback, useEffect, useState } from "react";
import { panelFetch, errorMessage, Btn, Card, Input, Label, Notice, Badge, PageHeader } from "@/components/admin/ui";
import { fmtTs } from "@/components/admin/format";

export default function SeguridadAdmin({ totpEnrolled }: { totpEnrolled: boolean }) {
  return (
    <div>
      <PageHeader
        eyebrow="Panel · Cuenta"
        title="Mi seguridad"
        dek="Cambiar la contraseña cierra tus otras sesiones. Si perdiste la app autenticadora, pedile el reset a otro administrador."
      />
      <div className="flex flex-col gap-4">
        <CambioPassword totpEnrolled={totpEnrolled} />
        <Sesiones />
      </div>
    </div>
  );
}

function CambioPassword({ totpEnrolled }: { totpEnrolled: boolean }) {
  const [actual, setActual] = useState("");
  const [nueva, setNueva] = useState("");
  const [confirm, setConfirm] = useState("");
  const [totp, setTotp] = useState("");
  const [msg, setMsg] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    if (nueva !== confirm) {
      setMsg({ kind: "error", text: "Las contraseñas no coinciden." });
      return;
    }
    setBusy(true);
    setMsg(null);
    const r = await panelFetch("/api/admin/panel/auth/password", {
      method: "POST",
      body: JSON.stringify({ actual, nueva, ...(totp.trim() ? { totp: totp.trim() } : {}) }),
    });
    setBusy(false);
    if (r.status === 200) {
      setMsg({ kind: "ok", text: "Contraseña actualizada. Tus otras sesiones quedaron cerradas." });
      setActual(""); setNueva(""); setConfirm(""); setTotp("");
    } else {
      setMsg({ kind: "error", text: errorMessage(r) });
    }
  }

  return (
    <Card title="Cambiar contraseña">
      <form onSubmit={submit} className="grid max-w-xl gap-4">
        <div>
          <Label htmlFor="sg-actual">Contraseña actual</Label>
          <Input id="sg-actual" type="password" autoComplete="current-password" required value={actual} onChange={(e) => setActual(e.target.value)} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="sg-nueva">Contraseña nueva (mínimo 12)</Label>
            <Input id="sg-nueva" type="password" autoComplete="new-password" minLength={12} required value={nueva} onChange={(e) => setNueva(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="sg-confirm">Repetir contraseña nueva</Label>
            <Input id="sg-confirm" type="password" autoComplete="new-password" minLength={12} required value={confirm} onChange={(e) => setConfirm(e.target.value)} />
          </div>
        </div>
        {totpEnrolled && (
          <div className="max-w-40">
            <Label htmlFor="sg-totp">Código de la app</Label>
            <Input
              id="sg-totp"
              inputMode="numeric"
              pattern="\d{6}"
              maxLength={6}
              required
              value={totp}
              onChange={(e) => setTotp(e.target.value.replace(/\D/g, ""))}
            />
          </div>
        )}
        {msg && <Notice kind={msg.kind}>{msg.text}</Notice>}
        <div>
          <Btn type="submit" disabled={busy}>{busy ? "Guardando…" : "Cambiar contraseña"}</Btn>
        </div>
      </form>
    </Card>
  );
}

type Sesion = {
  id: number;
  actual: boolean;
  creada: number;
  ultimaActividad: number;
  vence: number;
  userAgent: string | null;
};

function Sesiones() {
  const [sesiones, setSesiones] = useState<Sesion[] | null>(null);
  const [msg, setMsg] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const r = await panelFetch<{ sesiones: Sesion[] }>("/api/admin/panel/auth/sessions");
    if (r.status === 200 && r.data?.sesiones) setSesiones(r.data.sesiones);
    else setMsg({ kind: "error", text: errorMessage(r) });
  }, []);

  useEffect(() => {
    // Diferido a microtask: el linter de React exige que ningún setState corra
    // sincrónico dentro del effect (load setea estado al resolver el fetch).
    queueMicrotask(() => void load());
  }, [load]);

  async function cerrarOtras() {
    if (busy) return;
    setBusy(true);
    setMsg(null);
    const r = await panelFetch("/api/admin/panel/auth/sessions", { method: "DELETE" });
    if (r.status === 200) setMsg({ kind: "ok", text: "Las demás sesiones quedaron cerradas." });
    else setMsg({ kind: "error", text: errorMessage(r) });
    await load();
    setBusy(false);
  }

  return (
    <Card
      title="Sesiones activas"
      actions={
        <Btn kind="ghost" disabled={busy || !sesiones || sesiones.length <= 1} onClick={cerrarOtras}>
          Cerrar las demás
        </Btn>
      }
    >
      {msg && <div className="mb-3"><Notice kind={msg.kind}>{msg.text}</Notice></div>}
      {!sesiones ? (
        <p className="adm-help mt-0!">Cargando…</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="adm-table">
            <thead>
              <tr>
                <th>Inicio</th>
                <th>Última actividad</th>
                <th>Vence</th>
                <th>Navegador</th>
              </tr>
            </thead>
            <tbody>
              {sesiones.map((s) => (
                <tr key={s.id}>
                  <td className="mono num whitespace-nowrap">
                    {fmtTs(s.creada)} {s.actual && <Badge tone="pos">esta</Badge>}
                  </td>
                  <td className="mono num whitespace-nowrap">{fmtTs(s.ultimaActividad)}</td>
                  <td className="mono num whitespace-nowrap">{fmtTs(s.vence)}</td>
                  <td className="max-w-64 truncate text-xs text-[color:var(--site-ink-3)]" title={s.userAgent ?? ""}>
                    {s.userAgent ?? "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
