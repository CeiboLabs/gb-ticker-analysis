// Unit test del cap "cuchillo cayendo" en enforceConvictionDiscipline.
//   npx tsx scripts/dev-tests/test-conviction-knife.ts

import { enforceConvictionDiscipline } from "../../lib/derivedMetrics";
import type { RatingConditions } from "../../lib/derivedMetrics";
import type { TechnicalContext } from "../../lib/technicalContext";

type TechPick = Pick<TechnicalContext, "pctFromHigh" | "trend" | "ret6M">;

let pass = 0, fail = 0;
const ok = (c: boolean, l: string) => { if (c) pass++; else { fail++; console.error(`  ✗ ${l}`); } };

// Framework CONFIRMADO (para que los caps unbacked/speculative NO enmascaren el knife).
const confirmed: RatingConditions = {
  buyValuation: "met", buyConsensus: "met", buyBalance: "met",
  avoidValuation: "not_met", avoidBalance: "not_met", avoidInsiderShort: "not_met",
  buyConfirmed: true, avoidTriggered: false, buyConfirmedNoCoverage: false,
};
const tech = (trend: TechnicalContext["trend"], ret6M: number | null, pctFromHigh = -10): TechPick =>
  ({ trend, ret6M, pctFromHigh });

// 1. El caso NVO: BUY·HIGH + bajista + ret6M −25% → LOW + flag knife.
{
  const r = enforceConvictionDiscipline("BUY", "HIGH", confirmed, tech("bajista", -0.25));
  ok(r.conviction === "LOW", "BUY·HIGH bajista −25% → LOW");
  ok(r.flags.includes("conviction_capped_falling_knife"), "flag falling_knife");
}
// 2. Caída no tan fuerte (−15%, sobre el umbral −20%) → knife NO dispara.
{
  const r = enforceConvictionDiscipline("BUY", "MEDIUM", confirmed, tech("bajista", -0.15));
  ok(!r.flags.includes("conviction_capped_falling_knife"), "ret6M −15% no dispara knife");
}
// 3. Tendencia no bajista → knife NO dispara aunque caiga fuerte.
{
  const r = enforceConvictionDiscipline("BUY", "HIGH", confirmed, tech("mixta", -0.30));
  ok(!r.flags.includes("conviction_capped_falling_knife"), "trend mixta no dispara knife");
}
// 4. Ya en LOW → no re-flaggea (sólo baja, nunca redundante).
{
  const r = enforceConvictionDiscipline("BUY", "LOW", confirmed, tech("bajista", -0.30));
  ok(r.conviction === "LOW" && !r.flags.includes("conviction_capped_falling_knife"), "ya LOW no re-flaggea");
}
// 5. HOLD/AVOID no son cuchillos (el gate es sólo del BUY).
{
  const rH = enforceConvictionDiscipline("HOLD", "HIGH", confirmed, tech("bajista", -0.30));
  const rA = enforceConvictionDiscipline("AVOID", "HIGH", confirmed, tech("bajista", -0.30));
  ok(!rH.flags.includes("conviction_capped_falling_knife"), "HOLD no dispara knife");
  ok(!rA.flags.includes("conviction_capped_falling_knife"), "AVOID no dispara knife");
}
// 6. Interacción con speculative: MEDIUM primero, luego LOW por knife.
{
  const r = enforceConvictionDiscipline("BUY", "HIGH", confirmed, tech("bajista", -0.25), true);
  ok(r.conviction === "LOW", "speculative+knife → LOW (el knife gana)");
  ok(r.flags.includes("conviction_capped_speculative") && r.flags.includes("conviction_capped_falling_knife"), "ambos flags presentes");
}
// 7. technical null → sin crash, sin knife.
{
  const r = enforceConvictionDiscipline("BUY", "HIGH", confirmed, null);
  ok(!r.flags.includes("conviction_capped_falling_knife"), "technical null → sin knife");
}
// 8. Regresión: el cap de selloff del AVOID sigue funcionando.
{
  const r = enforceConvictionDiscipline("AVOID", "HIGH", { ...confirmed, avoidTriggered: true }, tech("bajista", -0.10, -40));
  ok(r.conviction === "MEDIUM" && r.flags.includes("conviction_capped_selloff"), "AVOID selloff cap intacto");
}
// 9. Cap por short interest elevado: BUY·HIGH + short 20% → MEDIUM.
{
  const r = enforceConvictionDiscipline("BUY", "HIGH", confirmed, tech("alcista", 0.10), false, 20);
  ok(r.conviction === "MEDIUM" && r.flags.includes("conviction_capped_high_short"), "BUY·HIGH short 20% → MEDIUM");
}
// 10. Short moderado (10%) NO capea; sin short tampoco.
{
  const r10 = enforceConvictionDiscipline("BUY", "HIGH", confirmed, tech("alcista", 0.10), false, 10);
  const rNull = enforceConvictionDiscipline("BUY", "HIGH", confirmed, tech("alcista", 0.10), false, null);
  ok(!r10.flags.includes("conviction_capped_high_short"), "short 10% no capea");
  ok(!rNull.flags.includes("conviction_capped_high_short"), "short null no capea");
}
// 11. AVOID/HOLD no gatillan el cap de short (es del BUY).
{
  const r = enforceConvictionDiscipline("AVOID", "HIGH", { ...confirmed, avoidTriggered: true }, tech("alcista", 0.10), false, 20);
  ok(!r.flags.includes("conviction_capped_high_short"), "AVOID no gatilla short cap");
}
// 12. Trampa de valor: BUY especulativo + revisiones a la baja → LOW.
{
  const r = enforceConvictionDiscipline("BUY", "MEDIUM", confirmed, tech("alcista", 0.05), true, null, true);
  ok(r.conviction === "LOW" && r.flags.includes("conviction_capped_revisions_down"), "BUY especulativo + revisiones↓ → LOW");
}
// 13. Revisiones↓ SIN especulativo (caja real) NO capea a LOW por esta vía.
{
  const r = enforceConvictionDiscipline("BUY", "MEDIUM", confirmed, tech("alcista", 0.05), false, null, true);
  ok(!r.flags.includes("conviction_capped_revisions_down"), "revisiones↓ sin especulativo no capea (hay caja real)");
}
// 14. Especulativo SIN revisiones↓ → no capea a LOW (queda en MEDIUM del cap especulativo).
{
  const r = enforceConvictionDiscipline("BUY", "HIGH", confirmed, tech("alcista", 0.05), true, null, false);
  ok(r.conviction === "MEDIUM" && !r.flags.includes("conviction_capped_revisions_down"), "especulativo sin revisiones↓ → MEDIUM, no LOW");
}

console.log(`\nconviction-knife: ${pass} pass, ${fail} fail`);
process.exit(fail === 0 ? 0 : 1);
