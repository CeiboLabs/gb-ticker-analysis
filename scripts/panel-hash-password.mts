// Generador OFFLINE de hashes de contraseña del panel — para recuperación por
// SQL cuando no queda ningún admin operativo (ver docs/RUNBOOK-panel.md).
//
// Necesita el MISMO pepper que el entorno destino (el hash se firma con él):
//   PANEL_PEPPER='<pepper de prod>' npx tsx scripts/panel-hash-password.mts 'la contraseña'
//
// Imprime el hash y el UPDATE listo para `wrangler d1 execute`. La contraseña
// se pasa por argv entre comillas simples; no queda en ningún archivo.

import { hashPassword, targetIters } from "../lib/panelCrypto";

async function main() {
  const password = process.argv[2];
  if (!password) {
    console.error("Uso: PANEL_PEPPER='<pepper>' npx tsx scripts/panel-hash-password.mts '<contraseña>'");
    process.exit(1);
  }
  if (!process.env.PANEL_PEPPER) {
    console.error("Falta PANEL_PEPPER en el entorno (debe ser el del entorno destino).");
    process.exit(1);
  }
  if (password.length < 12) {
    console.error("La política del panel exige mínimo 12 caracteres.");
    process.exit(1);
  }
  const hash = await hashPassword(password);
  console.log(`hash (${targetIters()} iteraciones):\n${hash}\n`);
  console.log("Aplicar con (ajustar el email):");
  console.log(
    `  npx wrangler d1 execute ticker-metrics --remote --command "UPDATE admin_users SET password_hash='${hash}', must_change_password=1, updated_at=${Date.now()} WHERE email='<email>'; UPDATE admin_sessions SET revoked_at=${Date.now()} WHERE user_id=(SELECT id FROM admin_users WHERE email='<email>') AND revoked_at IS NULL;"`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
