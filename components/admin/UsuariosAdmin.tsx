"use client";

// Gestión de usuarios (solo rol admin): alta con clave temporal, edición de
// rol/permisos/estado y resets de contraseña / segundo factor. Las guardas
// duras (último admin, auto-bloqueo) viven en el server; acá solo se reflejan.

import { useCallback, useEffect, useState } from "react";
import { panelFetch, errorMessage, Btn, Card, Input, Label, Notice, Badge, PageHeader, Select } from "@/components/admin/ui";

const PERMS = [
  { key: "informes", label: "Informes" },
  { key: "fondo", label: "Fondo BNG" },
  { key: "monitor", label: "Monitor" },
  { key: "secciones", label: "Secciones" },
] as const;

type Usuario = {
  id: number;
  email: string;
  nombre: string;
  role: "admin" | "editor";
  perms: string[];
  status: "active" | "disabled";
  totpEnrolled: boolean;
  mustChangePassword: boolean;
};

/** Clave temporal legible para dictar por teléfono: 4 bloques de 4 [a-z2-9]. */
function generarTemporal(): string {
  const abc = "abcdefghjkmnpqrstuvwxyz23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  const chars = Array.from(bytes, (b) => abc[b % abc.length]);
  return `${chars.slice(0, 4).join("")}-${chars.slice(4, 8).join("")}-${chars.slice(8, 12).join("")}-${chars.slice(12).join("")}`;
}

export default function UsuariosAdmin() {
  const [usuarios, setUsuarios] = useState<Usuario[] | null>(null);
  const [yo, setYo] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const load = useCallback(async () => {
    const r = await panelFetch<{ usuarios: Usuario[]; yo: number }>("/api/admin/panel/usuarios");
    if (r.status === 200 && r.data?.usuarios) {
      setUsuarios(r.data.usuarios);
      setYo(r.data.yo);
    } else {
      setError(errorMessage(r));
    }
  }, []);

  useEffect(() => {
    // Diferido a microtask: el linter de React exige que ningún setState corra
    // sincrónico dentro del effect (load setea estado al resolver el fetch).
    queueMicrotask(() => void load());
  }, [load]);

  function flash(msg: string) {
    setOk(msg);
    setError(null);
  }

  return (
    <div>
      <PageHeader
        eyebrow="Panel · Cuentas"
        title="Usuarios"
        dek="Cada empleado ve sólo sus secciones. La clave temporal se entrega en mano: el primer login exige cambiarla y configurar la app autenticadora."
      />
      <div className="flex flex-col gap-4">
        {error && <Notice kind="error">{error}</Notice>}
        {ok && <Notice kind="ok">{ok}</Notice>}
        <NuevoUsuario onCreated={(msg) => { flash(msg); void load(); }} onError={setError} />
        {!usuarios ? (
          <p className="adm-help mt-0!">Cargando…</p>
        ) : (
          <div className="flex flex-col gap-3">
            {usuarios.map((u) => (
              <FilaUsuario key={u.id} u={u} esYo={u.id === yo} onChanged={(m) => { flash(m); void load(); }} onError={setError} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function NuevoUsuario({ onCreated, onError }: { onCreated: (msg: string) => void; onError: (e: string) => void }) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [nombre, setNombre] = useState("");
  const [role, setRole] = useState<"admin" | "editor">("editor");
  const [perms, setPerms] = useState<string[]>([]);
  const [temp, setTemp] = useState(generarTemporal());
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    const r = await panelFetch("/api/admin/panel/usuarios", {
      method: "POST",
      body: JSON.stringify({ email, nombre, role, perms: role === "admin" ? [] : perms, tempPassword: temp }),
    });
    setBusy(false);
    if (r.status === 200) {
      onCreated(`Usuario ${email} creado. Entregale la clave temporal: ${temp}`);
      setOpen(false);
      setEmail(""); setNombre(""); setRole("editor"); setPerms([]); setTemp(generarTemporal());
    } else if (r.status === 409) {
      onError("Ya existe un usuario con ese email.");
    } else {
      onError(errorMessage(r));
    }
  }

  if (!open) {
    return (
      <div>
        <Btn onClick={() => setOpen(true)}>+ Nuevo usuario</Btn>
      </div>
    );
  }
  return (
    <Card title="Nuevo usuario">
      <form onSubmit={submit} className="grid gap-4 md:grid-cols-2">
        <div>
          <Label htmlFor="nu-nombre">Nombre</Label>
          <Input id="nu-nombre" required value={nombre} onChange={(e) => setNombre(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="nu-email">Email</Label>
          <Input id="nu-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="nu-role">Rol</Label>
          <Select
            id="nu-role"
            value={role}
            onChange={(e) => setRole(e.target.value as "admin" | "editor")}
          >
            <option value="editor">Editor (secciones asignadas)</option>
            <option value="admin">Admin (todo + usuarios)</option>
          </Select>
        </div>
        {role === "editor" && (
          <div>
            <Label>Secciones</Label>
            <div className="flex flex-wrap gap-x-4 gap-y-2 pt-1">
              {PERMS.map((p) => (
                <label key={p.key} className="adm-check">
                  <input
                    type="checkbox"
                    checked={perms.includes(p.key)}
                    onChange={(e) =>
                      setPerms((prev) => (e.target.checked ? [...prev, p.key] : prev.filter((x) => x !== p.key)))
                    }
                  />
                  {p.label}
                </label>
              ))}
            </div>
          </div>
        )}
        <div className="md:col-span-2">
          <Label htmlFor="nu-temp">Clave temporal (se la das al empleado; el primer login lo obliga a cambiarla)</Label>
          <div className="flex gap-2">
            <Input id="nu-temp" readOnly value={temp} className="mono" />
            <Btn kind="ghost" onClick={() => setTemp(generarTemporal())}>Regenerar</Btn>
          </div>
        </div>
        <div className="flex gap-2 md:col-span-2">
          <Btn type="submit" disabled={busy}>{busy ? "Creando…" : "Crear usuario"}</Btn>
          <Btn kind="ghost" onClick={() => setOpen(false)}>Cancelar</Btn>
        </div>
      </form>
    </Card>
  );
}

function FilaUsuario({
  u,
  esYo,
  onChanged,
  onError,
}: {
  u: Usuario;
  esYo: boolean;
  onChanged: (msg: string) => void;
  onError: (e: string) => void;
}) {
  const [editando, setEditando] = useState(false);
  const [busy, setBusy] = useState(false);

  async function patch(fields: Record<string, unknown>, msg: string) {
    if (busy) return;
    setBusy(true);
    const r = await panelFetch(`/api/admin/panel/usuarios/${u.id}`, { method: "PATCH", body: JSON.stringify(fields) });
    setBusy(false);
    if (r.status === 200) onChanged(msg);
    else onError(errorMessage(r) === "Datos inválidos." ? errorMessage(r) : (r.data?.detalle as string) ?? errorMessage(r));
  }

  async function resetPassword() {
    if (busy) return;
    const temp = generarTemporal();
    if (!window.confirm(`Resetear la contraseña de ${u.email}?\nSe cierran sus sesiones y la clave temporal será:\n\n${temp}`)) return;
    setBusy(true);
    const r = await panelFetch(`/api/admin/panel/usuarios/${u.id}/reset-password`, {
      method: "POST",
      body: JSON.stringify({ tempPassword: temp }),
    });
    setBusy(false);
    if (r.status === 200) onChanged(`Contraseña de ${u.email} reseteada. Clave temporal: ${temp}`);
    else onError(errorMessage(r));
  }

  async function resetTotp() {
    if (busy) return;
    if (!window.confirm(`Resetear el segundo factor de ${u.email}? Se cierran sus sesiones y el próximo login vuelve a enrolar la app.`)) return;
    setBusy(true);
    const r = await panelFetch(`/api/admin/panel/usuarios/${u.id}/reset-totp`, { method: "POST", body: JSON.stringify({}) });
    setBusy(false);
    if (r.status === 200) onChanged(`Segundo factor de ${u.email} reseteado.`);
    else onError(errorMessage(r));
  }

  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-2 text-sm">
            {u.nombre}
            {esYo && <Badge tone="neutral">vos</Badge>}
            <Badge tone={u.role === "admin" ? "gold" : "neutral"}>{u.role === "admin" ? "Admin" : "Editor"}</Badge>
            <Badge tone={u.status === "active" ? "pos" : "neg"}>{u.status === "active" ? "Activo" : "Deshabilitado"}</Badge>
          </p>
          <p className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-[color:var(--site-ink-3)]">
            <span>{u.email}</span>
            <span>·</span>
            <span>{u.role === "admin" ? "todas las secciones" : u.perms.length ? u.perms.join(", ") : "sin secciones"}</span>
            <Badge tone={u.totpEnrolled ? "pos" : "neu"}>{u.totpEnrolled ? "2FA activo" : "2FA pendiente"}</Badge>
            {u.mustChangePassword && <Badge tone="neu">clave temporal</Badge>}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Btn kind="ghost" onClick={() => setEditando((v) => !v)}>{editando ? "Cerrar" : "Editar"}</Btn>
          {!esYo && (
            <>
              <Btn kind="ghost" disabled={busy} onClick={resetPassword}>Reset clave</Btn>
              <Btn kind="ghost" disabled={busy || !u.totpEnrolled} onClick={resetTotp}>Reset 2FA</Btn>
              {u.status === "active" ? (
                <Btn kind="danger" disabled={busy} onClick={() => patch({ status: "disabled" }, `${u.email} deshabilitado (sesiones cerradas).`)}>
                  Deshabilitar
                </Btn>
              ) : (
                <Btn disabled={busy} onClick={() => patch({ status: "active" }, `${u.email} rehabilitado.`)}>
                  Habilitar
                </Btn>
              )}
            </>
          )}
        </div>
      </div>
      {editando && <EditarUsuario u={u} esYo={esYo} busy={busy} onSubmit={(fields) => patch(fields, `${u.email} actualizado.`)} />}
    </Card>
  );
}

function EditarUsuario({
  u,
  esYo,
  busy,
  onSubmit,
}: {
  u: Usuario;
  esYo: boolean;
  busy: boolean;
  onSubmit: (fields: Record<string, unknown>) => void;
}) {
  const [nombre, setNombre] = useState(u.nombre);
  const [role, setRole] = useState(u.role);
  const [perms, setPerms] = useState<string[]>(u.perms);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const fields: Record<string, unknown> = {};
    if (nombre !== u.nombre) fields.nombre = nombre;
    if (role !== u.role) fields.role = role;
    if (role === "editor" && perms.slice().sort().join(",") !== u.perms.slice().sort().join(",")) fields.perms = perms;
    if (Object.keys(fields).length === 0) return;
    onSubmit(fields);
  }

  return (
    <form onSubmit={submit} className="mt-4 grid gap-4 border-t border-[color:var(--site-border)] pt-4 md:grid-cols-3">
      <div>
        <Label htmlFor={`eu-nombre-${u.id}`}>Nombre</Label>
        <Input id={`eu-nombre-${u.id}`} value={nombre} onChange={(e) => setNombre(e.target.value)} />
      </div>
      <div>
        <Label htmlFor={`eu-role-${u.id}`}>Rol</Label>
        <Select
          id={`eu-role-${u.id}`}
          value={role}
          disabled={esYo}
          onChange={(e) => setRole(e.target.value as "admin" | "editor")}
        >
          <option value="editor">Editor</option>
          <option value="admin">Admin</option>
        </Select>
        {esYo && <p className="adm-help">Tu propio rol lo cambia otro admin.</p>}
      </div>
      {role === "editor" && (
        <div>
          <Label>Secciones</Label>
          <div className="flex flex-wrap gap-x-4 gap-y-2 pt-1">
            {PERMS.map((p) => (
              <label key={p.key} className="adm-check">
                <input
                  type="checkbox"
                  checked={perms.includes(p.key)}
                  onChange={(e) => setPerms((prev) => (e.target.checked ? [...prev, p.key] : prev.filter((x) => x !== p.key)))}
                />
                {p.label}
              </label>
            ))}
          </div>
        </div>
      )}
      <div className="md:col-span-3">
        <Btn type="submit" disabled={busy}>Guardar cambios</Btn>
      </div>
    </form>
  );
}
