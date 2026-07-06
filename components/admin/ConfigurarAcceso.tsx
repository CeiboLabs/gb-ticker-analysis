"use client";

// Primer acceso / post-reset: ordena el flujo de setup de la cuenta.
//   Paso 1 — cambiar la contraseña temporal (si corresponde).
//   Paso 2 — enrolar el segundo factor: QR + secret en texto + primer código.
// Al verificar el código, el server promueve la sesión a completa (token
// nuevo) y esto navega al panel.

import { useState } from "react";
import TotpQr from "@/components/admin/TotpQr";
import { panelFetch, errorMessage, Btn, Input, Label, Notice, Card } from "@/components/admin/ui";

type Props = {
  email: string;
  mustChangePassword: boolean;
  totpEnrolled: boolean;
};

export default function ConfigurarAcceso({ email, mustChangePassword, totpEnrolled }: Props) {
  const [needsPassword, setNeedsPassword] = useState(mustChangePassword);

  return (
    <div className="flex flex-col gap-6">
      <Notice kind="info">
        Cuenta: <strong>{email}</strong>. Para operar el panel hace falta una contraseña propia y una app
        autenticadora (Google Authenticator, 1Password, Aegis, etc.).
      </Notice>
      {needsPassword ? (
        <PasoPassword totpEnrolled={totpEnrolled} onDone={() => setNeedsPassword(false)} />
      ) : !totpEnrolled ? (
        <PasoTotp />
      ) : (
        <Card title="Todo listo">
          <a href="/admin" className="site-link">
            Ir al panel →
          </a>
        </Card>
      )}
    </div>
  );
}

function PasoPassword({ totpEnrolled, onDone }: { totpEnrolled: boolean; onDone: () => void }) {
  const [actual, setActual] = useState("");
  const [nueva, setNueva] = useState("");
  const [confirm, setConfirm] = useState("");
  const [totp, setTotp] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    if (nueva !== confirm) {
      setError("Las contraseñas no coinciden.");
      return;
    }
    setBusy(true);
    setError(null);
    const r = await panelFetch("/api/admin/panel/auth/password", {
      method: "POST",
      body: JSON.stringify({ actual, nueva, ...(totp.trim() ? { totp: totp.trim() } : {}) }),
    });
    if (r.status === 200) {
      if (r.data?.next) {
        window.location.href = r.data.next;
        return;
      }
      onDone();
      return;
    }
    setError(errorMessage(r));
    setBusy(false);
  }

  return (
    <Card title="Paso 1 · Elegí tu contraseña">
      <form onSubmit={submit} className="flex flex-col gap-4">
        <div>
          <Label htmlFor="pw-actual">Contraseña actual (la temporal que te dieron)</Label>
          <Input
            id="pw-actual"
            type="password"
            autoComplete="current-password"
            required
            value={actual}
            onChange={(e) => setActual(e.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="pw-nueva">Contraseña nueva (mínimo 12 caracteres)</Label>
          <Input
            id="pw-nueva"
            type="password"
            autoComplete="new-password"
            minLength={12}
            required
            value={nueva}
            onChange={(e) => setNueva(e.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="pw-confirm">Repetir contraseña nueva</Label>
          <Input
            id="pw-confirm"
            type="password"
            autoComplete="new-password"
            minLength={12}
            required
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
        </div>
        {totpEnrolled && (
          <div>
            <Label htmlFor="pw-totp">Código de la app autenticadora</Label>
            <Input
              id="pw-totp"
              inputMode="numeric"
              pattern="\d{6}"
              maxLength={6}
              required
              value={totp}
              onChange={(e) => setTotp(e.target.value.replace(/\D/g, ""))}
            />
          </div>
        )}
        {error && <Notice kind="error">{error}</Notice>}
        <Btn type="submit" disabled={busy}>
          {busy ? "Guardando…" : "Guardar contraseña"}
        </Btn>
      </form>
    </Card>
  );
}

function PasoTotp() {
  const [secret, setSecret] = useState<string | null>(null);
  const [otpauth, setOtpauth] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function start() {
    if (busy) return;
    setBusy(true);
    setError(null);
    const r = await panelFetch<{ secret: string; otpauth: string }>("/api/admin/panel/auth/totp/start", {
      method: "POST",
    });
    if (r.status === 200 && r.data?.secret && r.data?.otpauth) {
      setSecret(r.data.secret);
      setOtpauth(r.data.otpauth);
    } else {
      setError(errorMessage(r));
    }
    setBusy(false);
  }

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    const r = await panelFetch("/api/admin/panel/auth/totp/verify", {
      method: "POST",
      body: JSON.stringify({ code: code.trim() }),
    });
    if (r.status === 200 && r.data?.next) {
      window.location.href = r.data.next;
      return;
    }
    setError(errorMessage(r));
    setBusy(false);
  }

  return (
    <Card title="Paso 2 · Configurá el segundo factor">
      {!secret || !otpauth ? (
        <div className="flex flex-col gap-3">
          <p className="adm-help">
            Se genera un código QR para escanear con tu app autenticadora. El panel exige este segundo factor en
            cada ingreso.
          </p>
          {error && <Notice kind="error">{error}</Notice>}
          <div>
            <Btn onClick={start} disabled={busy}>
              {busy ? "Generando…" : "Generar código QR"}
            </Btn>
          </div>
        </div>
      ) : (
        <form onSubmit={verify} className="flex flex-col gap-4">
          <div className="flex flex-wrap items-start gap-5">
            <TotpQr otpauth={otpauth} />
            <div className="min-w-56 flex-1 text-sm text-[color:var(--site-ink-2)]">
              <p className="mb-2">1. Escaneá el QR con la app (o cargá la clave a mano).</p>
              <p className="adm-lbl mb-1.5">Clave manual</p>
              <code className="adm-secret">{secret.replace(/(.{4})/g, "$1 ").trim()}</code>
              <p className="mt-3">2. Ingresá el código de 6 dígitos que muestra la app.</p>
            </div>
          </div>
          <div className="max-w-40">
            <Label htmlFor="totp-code">Código</Label>
            <Input
              id="totp-code"
              inputMode="numeric"
              pattern="\d{6}"
              maxLength={6}
              autoComplete="one-time-code"
              required
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
            />
          </div>
          {error && <Notice kind="error">{error}</Notice>}
          <div>
            <Btn type="submit" disabled={busy}>
              {busy ? "Verificando…" : "Activar y entrar al panel"}
            </Btn>
          </div>
        </form>
      )}
    </Card>
  );
}
