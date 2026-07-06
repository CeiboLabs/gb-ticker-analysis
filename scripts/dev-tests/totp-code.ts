// Código TOTP vigente para un secret base32 — para probar el login del panel
// sin celular (el secret se ve en texto durante el enrolamiento).
// Correr:  npx tsx scripts/dev-tests/totp-code.ts <SECRET_BASE32>

import { totpCode, TOTP_STEP_MS, base32Decode } from "../../lib/panelCrypto";

async function main() {
  const secret = process.argv[2]?.trim();
  if (!secret) {
    console.error("Uso: npx tsx scripts/dev-tests/totp-code.ts <SECRET_BASE32>");
    process.exit(1);
  }
  if (!base32Decode(secret)) {
    console.error("Secret base32 inválido.");
    process.exit(1);
  }
  const now = Date.now();
  const step = Math.floor(now / TOTP_STEP_MS);
  const remaining = Math.ceil((TOTP_STEP_MS - (now % TOTP_STEP_MS)) / 1000);
  console.log(`código: ${await totpCode(secret, step)}   (vence en ${remaining}s; siguiente: ${await totpCode(secret, step + 1)})`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
