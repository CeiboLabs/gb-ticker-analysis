"use client";

// Login del panel: email + contraseña + código TOTP en un solo paso. El código
// queda opcional en el form porque el primer acceso (sin TOTP enrolado) entra
// solo con contraseña y sigue al enrolamiento; el server decide.

import { useState } from "react";
import { panelFetch, errorMessage, Btn, Input, Label, Notice, Card } from "@/components/admin/ui";

export default function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [totp, setTotp] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    const r = await panelFetch("/api/admin/panel/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password, ...(totp.trim() ? { totp: totp.trim() } : {}) }),
      redirectOn401: false,
    });
    if (r.status === 200 && r.data?.next) {
      window.location.href = r.data.next;
      return;
    }
    setError(errorMessage(r));
    setBusy(false);
  }

  return (
    <Card title="Ingreso de empleados">
      <form onSubmit={submit} className="flex flex-col gap-4">
        <div>
          <Label htmlFor="login-email">Email</Label>
          <Input
            id="login-email"
            type="email"
            autoComplete="username"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="login-password">Contraseña</Label>
          <Input
            id="login-password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="login-totp">Código de la app autenticadora</Label>
          <Input
            id="login-totp"
            inputMode="numeric"
            pattern="\d{6}"
            maxLength={6}
            placeholder="6 dígitos"
            autoComplete="one-time-code"
            value={totp}
            onChange={(e) => setTotp(e.target.value.replace(/\D/g, ""))}
          />
          <p className="adm-help">Si es tu primer ingreso, dejalo vacío: se configura a continuación.</p>
        </div>
        {error && <Notice kind="error">{error}</Notice>}
        <Btn type="submit" disabled={busy}>
          {busy ? "Verificando…" : "Ingresar"}
        </Btn>
      </form>
    </Card>
  );
}
