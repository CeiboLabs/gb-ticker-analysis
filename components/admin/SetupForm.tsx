"use client";

// Bootstrap del primer administrador. Sólo funciona con la tabla de usuarios
// vacía y el ADMIN_TOKEN correcto; después de eso, el endpoint contesta 409
// para siempre y esta pantalla redirige al login.

import { useState } from "react";
import { panelFetch, errorMessage, Btn, Input, Label, Notice, Card } from "@/components/admin/ui";

export default function SetupForm() {
  const [token, setToken] = useState("");
  const [nombre, setNombre] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    if (password !== confirm) {
      setError("Las contraseñas no coinciden.");
      return;
    }
    setBusy(true);
    setError(null);
    const r = await panelFetch("/api/admin/panel/auth/setup", {
      method: "POST",
      body: JSON.stringify({ token, nombre, email, password }),
      redirectOn401: false,
    });
    if (r.status === 200) {
      setDone(true);
      return;
    }
    setError(errorMessage(r));
    setBusy(false);
  }

  if (done) {
    return (
      <Card title="Administrador creado">
        <div className="flex flex-col gap-3">
          <Notice kind="ok">
            Cuenta creada. Ingresá con tu email y contraseña — el segundo factor se configura en el primer login.
          </Notice>
          <a href="/admin/login" className="site-link">
            Ir al login →
          </a>
        </div>
      </Card>
    );
  }

  return (
    <Card title="Instalación del panel — primer administrador">
      <form onSubmit={submit} className="flex flex-col gap-4">
        <div>
          <Label htmlFor="setup-token">Token de instalación (ADMIN_TOKEN)</Label>
          <Input id="setup-token" type="password" required value={token} onChange={(e) => setToken(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="setup-nombre">Nombre</Label>
          <Input id="setup-nombre" required value={nombre} onChange={(e) => setNombre(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="setup-email">Email</Label>
          <Input id="setup-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="setup-password">Contraseña (mínimo 12 caracteres)</Label>
          <Input
            id="setup-password"
            type="password"
            autoComplete="new-password"
            minLength={12}
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="setup-confirm">Repetir contraseña</Label>
          <Input
            id="setup-confirm"
            type="password"
            autoComplete="new-password"
            minLength={12}
            required
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
        </div>
        {error && <Notice kind="error">{error}</Notice>}
        <Btn type="submit" disabled={busy}>
          {busy ? "Creando…" : "Crear administrador"}
        </Btn>
      </form>
    </Card>
  );
}
