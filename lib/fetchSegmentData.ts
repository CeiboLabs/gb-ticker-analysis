import type { SegmentSankeyData, IndustryProfile } from "@/types/Report";
import { fetchEdgarAll, type EdgarIncomeStatement, type EdgarSegmentResult, type EdgarFilingSelection } from "@/lib/fetchEdgarSegments";
import { fetchUsdRate } from "@/lib/fxRates";

// Convert every monetary line on an EdgarIncomeStatement from its native
// reporting currency to USD using a Frankfurter (ECB)-sourced rate. Used by
// the Sankey path for foreign-private issuers — Canadian MJDS 40-F filers
// (CCJ/Cameco, NTR, GOLD, SU, RY, TD, BNS, ...) and IFRS 20-F filers (NOK,
// ASML) — whose XBRL facts are tagged in CAD/EUR/GBP/JPY/... rather than
// USD. Returns null when FX is unavailable so the caller can fall back to
// the Yahoo-TTM path instead of rendering wrong-currency numbers labeled as
// USD. Mirrors `convertEdgar8KToUsd` in app/api/analyze/route.ts.
async function convertISToUsd(
  is: EdgarIncomeStatement,
  segmentResult: EdgarSegmentResult | null,
): Promise<{ is: EdgarIncomeStatement; segmentResult: EdgarSegmentResult | null } | null> {
  const code = (is.currency ?? "USD").toUpperCase();
  if (code === "USD") return { is, segmentResult };
  // FX del cierre del período del filing (per-period), no el de hoy.
  const rate = await fetchUsdRate(code, is.endDate);
  if (!rate || rate <= 0) return null;
  const m = (v: number): number => v * rate;
  const converted: EdgarIncomeStatement = {
    ...is,
    currency: "USD",
    revenue:                m(is.revenue),
    grossProfit:            m(is.grossProfit),
    costOfRevenue:          m(is.costOfRevenue),
    operatingIncome:        m(is.operatingIncome),
    netIncome:              m(is.netIncome),
    rd:                     m(is.rd),
    salesMarketing:         m(is.salesMarketing),
    generalAdmin:           m(is.generalAdmin),
    sga:                    m(is.sga),
    tax:                    m(is.tax),
    incomeBeforeTax:        m(is.incomeBeforeTax),
    fuel:                   m(is.fuel),
    salariesWages:          m(is.salariesWages),
    maintenance:            m(is.maintenance),
    aircraftRental:         m(is.aircraftRental),
    landingFees:            m(is.landingFees),
    daExpense:              m(is.daExpense),
    costsAndExpenses:       m(is.costsAndExpenses),
    interestIncome:         m(is.interestIncome),
    interestExpense:        m(is.interestExpense),
    provisionForLoanLosses: m(is.provisionForLoanLosses),
    noninterestIncome:      m(is.noninterestIncome),
    noninterestExpense:     m(is.noninterestExpense),
    bankCompensation:       m(is.bankCompensation),
    bankTechnology:         m(is.bankTechnology),
    bankProfessional:       m(is.bankProfessional),
    bankOccupancy:          m(is.bankOccupancy),
    bankMarketing:          m(is.bankMarketing),
    bankOtherNoninterest:   m(is.bankOtherNoninterest),
    bankProvisionIFRS:      m(is.bankProvisionIFRS),
    premiumsEarned:         m(is.premiumsEarned),
    policyholderBenefits:   m(is.policyholderBenefits),
    underwritingExpense:    m(is.underwritingExpense),
    rentalIncome:           m(is.rentalIncome),
    managementFees:         m(is.managementFees),
    performanceFees:        m(is.performanceFees),
    compensationExpense:    m(is.compensationExpense),
    stockBasedComp:         m(is.stockBasedComp),
    impairment:             m(is.impairment),
    restructuring:          m(is.restructuring),
    gainLossOnSale:         m(is.gainLossOnSale),
    taxesOther:             m(is.taxesOther),
    explorationExpense:     m(is.explorationExpense),
    payroll:                m(is.payroll),
    rentExpense:            m(is.rentExpense),
    advertising:            m(is.advertising),
    daExpenseStandard:      m(is.daExpenseStandard),
  };
  const convertedSegments = segmentResult
    ? {
        ...segmentResult,
        segments: segmentResult.segments.map((s) => ({
          ...s,
          valueUSD: s.valueUSD * rate,
        })),
      }
    : null;
  return { is: converted, segmentResult: convertedSegments };
}

// SIC code prefixes used as tiebreakers in industry detection. SIC alone is
// not authoritative — issuers self-classify, and many banks/REITs file under
// generic SICs — so concept signatures take priority and SIC only confirms.
const SIC_BANK         = ["6020", "6021", "6022", "6029", "6199", "6711"];
const SIC_INSURANCE    = ["6311", "6321", "6331", "6411", "6770"];
const SIC_REIT         = ["6798"];
const SIC_ASSET_MGR    = ["6282", "6199"];
const SIC_BIOTECH      = ["2836", "8731"];
const SIC_OIL_GAS      = ["1311", "1381", "2911", "1389"];
// Mining (BHP, RIO, GOLD, AEM, FCX, NEM, SCCO, ...) — IS shape mirrors
// oil & gas: production-cost dominated, no clean GP/COGS layer, D&A heavy.
// Map to oil-gas profile so the breakdown logic (D&A / TaxesOther /
// Exploration / Purchases) renders the same way.
const SIC_MINING       = ["1000", "1040", "1090", "1220", "1221", "1222", "1311", "1381", "1400", "1411", "1474"];

function sicMatches(sic: string | undefined, prefixes: string[]): boolean {
  if (!sic) return false;
  return prefixes.some((p) => sic.startsWith(p));
}

// Pre-airline detection. The airline check is part of the standard pipeline
// (in fetchSegmentData) and depends on derived gp/op values, so we re-detect
// it here using the same predicate the consumer uses below.
function isAirlineProfile(is: EdgarIncomeStatement): boolean {
  const airlineSignalCount =
    (is.maintenance > 0 ? 1 : 0) +
    (is.aircraftRental > 0 ? 1 : 0) +
    (is.landingFees > 0 ? 1 : 0) +
    (is.daExpense > 0 && is.fuel + is.salariesWages + is.maintenance > is.revenue * 0.3 ? 1 : 0);
  const baseAirline = is.fuel > 0 && is.salariesWages > 0 && is.revenue > 0;
  const mainline = baseAirline && is.fuel / is.revenue >= 0.05 && airlineSignalCount >= 1;
  const regionalRatio = is.revenue > 0
    ? (is.fuel + is.salariesWages + is.maintenance + is.daExpense) / is.revenue
    : 0;
  const regional = is.salariesWages > 0 && is.maintenance > 0 && is.revenue > 0 && regionalRatio >= 0.4;
  return mainline || regional;
}

// Classify the filing into an IndustryProfile. Concept signatures take
// priority; SIC is only used to confirm/reject when signatures are weak.
// Order matters — earliest match wins.
export function detectIndustryProfile(
  is: EdgarIncomeStatement,
  sicCode?: string,
): IndustryProfile {
  // 1. Bank — Interest Income + Interest Expense + (Provision OR Noninterest)
  //    are the load-bearing tags. SIC 60xx confirms but isn't required.
  if (
    is.interestIncome > 0 &&
    is.interestExpense > 0 &&
    (is.provisionForLoanLosses > 0 || is.noninterestIncome > 0) &&
    is.costOfRevenue === 0
  ) {
    return "bank";
  }
  if (sicMatches(sicCode, SIC_BANK) && is.interestIncome > 0 && is.interestExpense > 0) {
    return "bank";
  }

  // 2. Insurance — Premiums Earned + Policyholder Benefits.
  if (is.premiumsEarned > 0 && is.policyholderBenefits > 0) {
    return "insurance";
  }
  if (sicMatches(sicCode, SIC_INSURANCE) && is.premiumsEarned > 0) {
    return "insurance";
  }

  // 3. REIT — Rental Income dominates revenue + significant D&A.
  //    SIC 6798 alone is also a strong signal.
  if (
    is.rentalIncome > 0 && is.revenue > 0 &&
    is.rentalIncome / is.revenue >= 0.5 &&
    is.daExpense / is.revenue >= 0.1
  ) {
    return "reit";
  }
  if (sicMatches(sicCode, SIC_REIT)) {
    return "reit";
  }

  // 4. Asset manager — Management or Performance fees + high compensation
  //    ratio. The XBRL tags are inconsistent across filers (BLK uses
  //    InvestmentAdvisoryFees; KKR/APO use AssetManagementFees1) so we
  //    accept either signal.
  if (
    (is.managementFees > 0 || is.performanceFees > 0) &&
    is.compensationExpense > 0 && is.revenue > 0 &&
    is.compensationExpense / is.revenue >= 0.2
  ) {
    return "asset-manager";
  }
  if (sicMatches(sicCode, SIC_ASSET_MGR) && is.compensationExpense > 0 && is.revenue > 0) {
    return "asset-manager";
  }

  // 5. Airline — preserve existing detection (predicate moved above).
  if (isAirlineProfile(is)) {
    return "airline";
  }

  // 5b. Pre-revenue — issuer reports zero revenue but has tagged operating
  //     costs (G&A / R&D / D&A) and a net loss. NextDecade Corp (LNG
  //     developer pre-FID), clinical-stage biotechs before first sale, and
  //     dev-stage SPACs all fall here. Renders a Net-Loss-as-sink Sankey.
  if (
    is.revenue === 0 &&
    is.netIncome < 0 &&
    (is.costsAndExpenses > 0 || is.generalAdmin > 0 || is.rd > 0)
  ) {
    return "pre-revenue";
  }

  // 6. Oil/gas — OperatingIncomeLoss not tagged but IBT > 0. The "no op tag"
  //    condition is necessary but NOT sufficient: pharma (BMY: SIC 2834, no
  //    OperatingIncomeLoss tagged on the most recent 10-Q) and other
  //    issuers that simply omit the tag would otherwise match too, and the
  //    oil-gas branch downstream relabels the OpEx residual as "Purchases &
  //    Prod" — wrong for non-oil-gas. Require a positive oil-gas signal:
  //    either an oil-gas-specific cost line (TaxesOther / ExciseAndSalesTaxes
  //    or ExplorationExpense — both tagged by CVX, XOM, COP) or an oil-gas
  //    SIC code.
  if (
    is.operatingIncome === 0 && is.incomeBeforeTax > 0 &&
    is.revenue > 0 && is.costOfRevenue > 0 &&
    (is.taxesOther > 0 || is.explorationExpense > 0)
  ) {
    return "oil-gas";
  }
  if (sicMatches(sicCode, SIC_OIL_GAS) && is.operatingIncome === 0 && is.incomeBeforeTax > 0) {
    return "oil-gas";
  }
  // 6b. Mining (BHP, RIO, FCX, NEM, GOLD, AEM, SCCO, ...) — same IS shape
  //     as integrated oil/gas (commodity production, no clean GP/COGS,
  //     D&A heavy). SIC 1000-1499 is the canonical mining range. Route
  //     through oil-gas profile so the breakdown renderer treats them
  //     identically.
  if (sicMatches(sicCode, SIC_MINING) && is.revenue > 0 && is.costsAndExpenses > 0) {
    return "oil-gas";
  }

  // 7. Biotech — R&D dominates and operating loss. The standard render still
  //    works but the dedicated branch lets R&D > revenue render cleanly.
  if (
    is.rd > 0 && is.revenue > 0 &&
    (is.rd / is.revenue >= 0.5 || is.rd > is.revenue) &&
    is.netIncome < 0
  ) {
    return "biotech";
  }
  if (sicMatches(sicCode, SIC_BIOTECH) && is.rd > 0 && is.netIncome < 0) {
    return "biotech";
  }

  // 8. Services — no COGS, no GP, but operating income > 0 (V, MA, ADP).
  if (is.costOfRevenue === 0 && is.grossProfit === 0 && is.operatingIncome > 0) {
    return "services";
  }

  // 9. Holding — handled in consumer using segment count + corporate
  //    overhead; profile defaults to standard until Phase 3e (BRK is the
  //    only mainstream case and it has a 6-K-style filing pattern anyway).

  return "standard";
}


function autoScale(values: number[]): { unit: string; divisor: number } {
  const positive = values.filter((v) => isFinite(v) && v > 0);
  if (positive.length === 0) return { unit: "B", divisor: 1e9 };
  const max = Math.max(...positive);
  if (max >= 1e12) return { unit: "T", divisor: 1e12 };
  if (max >= 1e9)  return { unit: "B", divisor: 1e9 };
  if (max >= 1e6)  return { unit: "M", divisor: 1e6 };
  return { unit: "K", divisor: 1e3 };
}

// filingOverride: backtest point-in-time — mismo pipeline sobre un filing
// histórico (ver EdgarFilingSelection). Producción lo omite.
export async function fetchSegmentData(
  ticker: string,
  filingOverride?: EdgarFilingSelection | null,
): Promise<SegmentSankeyData | null> {
  // SEC EDGAR only covers US-listed companies — skip for non-US market tickers
  // (e.g., GGAL.BA, YPF.BA for BYMA; BRK.A/.B are single-letter and still attempted)
  const suffix = ticker.split(".").pop() ?? "";
  if (ticker.includes(".") && suffix.length >= 2) return null;

  try {
    const data = await fetchEdgarAll(ticker, filingOverride);
    if (!data) return null;

    // FX-convert to USD when the issuer reports in a non-USD currency
    // (CAD for Canadian MJDS 40-F filers, EUR/GBP/JPY/... for IFRS 20-F
    // filers). Returns null when FX is unavailable — caller falls back to
    // Yahoo, same as today, instead of rendering wrong-currency numbers
    // labeled as USD.
    const usdData = await convertISToUsd(data.incomeStatement, data.segmentResult);
    if (!usdData) return null;
    const is = usdData.is;
    const segmentResult = usdData.segmentResult;
    const { isAnnual, isForeign, foreignFormType, sicCode, sourceUrl } = data;

    const industryProfile = detectIndustryProfile(is, sicCode);

    // Include loss + opex magnitudes so pre-revenue issuers (revenue = 0,
    // gp/op/ni all clamped to 0 in autoScale's filter) still get a sensible
    // unit. Without this NEXT's $49M G&A would render as "0.05B".
    const { unit, divisor } = autoScale([
      is.revenue, is.grossProfit, is.costOfRevenue,
      is.operatingIncome, is.netIncome,
      Math.abs(is.netIncome), is.costsAndExpenses, is.interestExpense,
    ]);

    const sc = (v: number) =>
      parseFloat((Math.max(0, v) / divisor).toFixed(2));

    // Only derive GP when COGS is explicit; otherwise leave it at 0 so the
    // Sankey takes the service-company branch (Op Income vs Total Costs)
    // instead of computing GP = revenue − 0 = revenue.
    let gp          = is.grossProfit > 0
                        ? is.grossProfit
                        : (is.costOfRevenue > 0 ? Math.max(0, is.revenue - is.costOfRevenue) : 0);
    // Sanity check: tagged GP must reconcile with the OpEx breakdown that sits
    // BELOW it. The implied opex (gp − op) should be ≥ the sum of S&M + R&D +
    // G&A + SGA. TREE Q1 2026 case: GrossProfit=$100.8M (= rev − $226.5M of
    // variable marketing) but SellingAndMarketingExpense=$238.6M (the full
    // S&M line, which already INCLUDES that $226.5M). Implied opex $69.6M
    // vs S&M $238.6M alone → tagged GP is non-standard (carved out a chunk
    // of OpEx into COGS). Drop GP and route the chart through CostsAndExpenses
    // as a single Total-Op-Costs node, same as the oil-gas / no-GP layout.
    const breakdownSum = Math.max(0, is.rd) + Math.max(0, is.salesMarketing)
                       + Math.max(0, is.generalAdmin) + Math.max(0, is.sga);
    const impliedOpex  = gp - Math.max(0, is.operatingIncome);
    const gpInconsistent = gp > 0 && impliedOpex > 0 && breakdownSum > impliedOpex * 1.2;
    if (gpInconsistent) gp = 0;
    // Oil/integrated issuers (CVX, XOM) don't tag OperatingIncomeLoss in
    // XBRL — they go straight from "Total costs and other deductions" to
    // IBT. With op=0 the chart would try to link np/tax from a non-existent
    // "op" node and break the d3-sankey layout. Fall back to IBT (close
    // proxy: off only by interest/other non-op items).
    const op        = is.operatingIncome > 0
                        ? is.operatingIncome
                        : Math.max(0, is.incomeBeforeTax);
    // Airlines (AAL/DAL/UAL/LUV...) report fuel + labor as top-level expense
    // lines instead of a Cost-of-Revenue / Gross-Profit structure. Detect by
    // both being positive — only US carriers have this profile. Use total
    // CostsAndExpenses as the opex denominator since gp − op = 0 here.
    // Two acceptance paths:
    //   (a) Mainline: fuel ≥ 5% of revenue + ≥1 other airline cost signal
    //       (maintenance / aircraft rent / landing fees / D&A-with-bucket-mass).
    //   (b) Regional: capacity-purchase carriers (SKYW, ...) reimburse fuel
    //       through Flying-Agreement revenue, so the IS fuel line is tiny
    //       and may not even be XBRL-tagged (SKYW dropped us-gaap:FuelCosts
    //       in 2017 in favor of a custom concept). The airline-specific
    //       AircraftMaintenanceMaterialsAndRepairs tag plus a (labor + maint
    //       + D&A) ratio ≥40% of revenue identifies them unambiguously
    //       without admitting non-airlines — only carriers tag that concept.
    const airlineSignalCount =
      (is.maintenance > 0 ? 1 : 0) +
      (is.aircraftRental > 0 ? 1 : 0) +
      (is.landingFees > 0 ? 1 : 0) +
      (is.daExpense > 0 && is.fuel + is.salariesWages + is.maintenance > is.revenue * 0.3 ? 1 : 0);
    const baseAirline = is.fuel > 0 && is.salariesWages > 0 && is.revenue > 0;
    const mainlinePath = baseAirline
      && is.fuel / is.revenue >= 0.05
      && airlineSignalCount >= 1;
    // Regional path doesn't require a tagged fuel line — the airline-specific
    // maintenance concept is the load-bearing discriminator here.
    const regionalBucketRatio = is.revenue > 0
      ? (is.fuel + is.salariesWages + is.maintenance + is.daExpense) / is.revenue
      : 0;
    const regionalPath = is.salariesWages > 0
      && is.maintenance > 0
      && is.revenue > 0
      && regionalBucketRatio >= 0.4;
    const isAirline = mainlinePath || regionalPath;
    // Airline buckets pre-scaling. Q4 derivation can produce a bucket sum
    // that drifts from CostsAndExpenses when the issuer reports "Other
    // operating income/expense, net" credits in concepts we don't track
    // (ULCC's Q3 has OtherOperatingIncomeExpenseNet = −$69M, which means Q4
    // bucket sum > CostsAndExpenses by ~$65M). Scale the buckets down so
    // they sum exactly to CostsAndExpenses — the chart's Op. Costs node
    // matches its outflow sum without distorting which buckets dominate.
    const airlineBucketSumRaw = is.fuel + is.salariesWages + is.maintenance
      + is.aircraftRental + is.landingFees + is.daExpense
      + Math.max(0, is.salesMarketing);
    const airlineScale = isAirline
      && is.costsAndExpenses > 0
      && airlineBucketSumRaw > is.costsAndExpenses
        ? is.costsAndExpenses / airlineBucketSumRaw
        : 1;
    // Oil & gas issuers (XOM, CVX, COP) report a single CostsAndExpenses
    // total instead of CoGS + Opex, like airlines, but with different cost
    // lines (D&A, SG&A, Other Taxes, Exploration, plus a residual for crude
    // purchases & production). Reuse the airline pattern of routing the
    // breakdown through "Op. Costs" by forcing totalOpex = CostsAndExpenses
    // when GP=0; without this opex would clamp to 0 and the breakdown branch
    // in SankeyChart never executes.
    const isOilGas = industryProfile === "oil-gas" && is.costsAndExpenses > 0;
    // Pre-revenue: gp − op = 0 (both clamp to 0), so the standard formula
    // produces no opex parent for the breakdown to attach to. Use the
    // tagged OperatingExpenses total directly.
    const isPreRevenue = industryProfile === "pre-revenue";
    // Standard branch: use SIGNED operating income so loss periods don't
    // underestimate opex. RYOJ-style case — gp = $2.49M, operatingIncome =
    // −$755K — the unsigned formula clamps op to 0 and yields totalOpex = gp.
    // The signed math (gp − operatingIncome) returns the true OpEx of $3.24M,
    // matching the issuer's tagged us-gaap:OperatingExpenses concept.
    // Single-step IS issuers (ENB / pipelines, V / MA / payment networks)
    // tag a single CostsAndExpenses block instead of GP / COGS layers.
    // When gp=0 + costOfRevenue=0 + operatingIncome>0 + costsAndExpenses>0,
    // the gp − op fallback produces totalOpex=0 which collapses the entire
    // expense flow into a single block. Using CostsAndExpenses directly
    // preserves the full opex magnitude and lets the breakdown logic
    // surface G&A / D&A / Other buckets.
    const isSingleStepIS = gp === 0 && is.costOfRevenue === 0
      && is.operatingIncome > 0 && is.costsAndExpenses > 0;
    // Standard branch uses SIGNED operatingIncome so loss periods don't
    // understate opex (RYOJ FY2025 case described above). When the issuer
    // didn't tag OperatingIncomeLoss at all (is.operatingIncome === 0), the
    // signed formula collapses to `gp` and overstates opex by the missing
    // op-income amount — BMY's Q1 FY2026 10-Q lacks the tag and produced an
    // 8.07B opex bucket against a real ~4.83B (gp 8.07 − IBT-derived op
    // 3.24). Fall back to the IBT-proxy `op` only when the tag is missing,
    // preserving the signed-loss path for tagged issuers.
    const opForOpex = is.operatingIncome !== 0 ? is.operatingIncome : op;
    const totalOpex = isAirline
      ? (is.costsAndExpenses > 0 ? is.costsAndExpenses : airlineBucketSumRaw)
      : isOilGas
        ? is.costsAndExpenses
        : isPreRevenue
          ? is.costsAndExpenses
          : gpInconsistent && is.costsAndExpenses > 0
            ? is.costsAndExpenses
            : isSingleStepIS
              ? is.costsAndExpenses
              : Math.max(0, gp - opForOpex);

    const pct = (n: number) =>
      is.revenue ? parseFloat(((n / is.revenue) * 100).toFixed(1)) : undefined;

    // Prefer separate SM + G&A; fall back to combined SGA mapped to salesMarketing.
    // Exception: oil-gas issuers (XOM, CVX) report only the combined SGA line —
    // mapping it to "Sales & Mkt" is misleading for an integrated oil major
    // (the bulk is corporate G&A, not marketing), so route it to generalAdmin.
    const smRaw = is.salesMarketing > 0 ? is.salesMarketing
                : (!isOilGas && is.sga > 0 && is.generalAdmin <= 0 ? is.sga : 0);
    const smVal = isAirline ? smRaw * airlineScale : smRaw;
    const gaVal = is.generalAdmin > 0
      ? is.generalAdmin
      : (isOilGas && is.sga > 0 ? is.sga : 0);
    const rdVal = is.rd > 0 ? is.rd : 0;

    // Airline buckets — combine aircraft rent + landing fees into a single
    // "Rent & Landing" line so the Sankey doesn't blow up with too many
    // outflow nodes. Regional ops, special items, and the airline "Other"
    // catchall fall into the residual `otherOpex` bucket below. Multiply by
    // `airlineScale` (= 1 unless Q4 derivation overshot) to keep the bucket
    // sum aligned with CostsAndExpenses.
    const fuelVal       = isAirline ? is.fuel * airlineScale : 0;
    const laborVal      = isAirline ? is.salariesWages * airlineScale : 0;
    const maintVal      = isAirline ? is.maintenance * airlineScale : 0;
    const rentLandVal   = isAirline ? (is.aircraftRental + is.landingFees) * airlineScale : 0;
    const daVal         = isAirline
      ? is.daExpense * airlineScale
      : (isOilGas || isPreRevenue ? is.daExpense : 0);

    // Oil & gas-specific buckets. Other Taxes (production + sales-based) and
    // Exploration are top-level cost lines on the integrated-major income
    // statement; the residual ("Purchases & Production") absorbs crude/refined
    // product purchases plus production & manufacturing — they aren't tagged
    // as separate XBRL concepts but together dominate the cost stack.
    const taxesOtherVal  = isOilGas ? Math.max(0, is.taxesOther)         : 0;
    const explorationVal = isOilGas ? Math.max(0, is.explorationExpense) : 0;

    // Standard-profile sub-buckets — surfaced only when the issuer reports
    // payroll / rent / advertising / D&A as separate IS lines that reconcile
    // to the tagged OperatingExpenses total. For typical SaaS/tech where
    // payroll sits inside G&A, the reconciliation fails (G&A alone already
    // accounts for most of opex) and these stay zero. RYOJ-style foreign
    // issuers explicitly break OpEx into Payroll + G&A + Rent + D&A on the
    // face of the IS, so the breakdown reconciles to within ~3 % of the
    // tagged total — admit them.
    let payrollVal = 0, rentExpVal = 0, advertisingVal = 0, daStdVal = 0;
    const isStandard = !isAirline && !isOilGas && !isPreRevenue;
    if (isStandard) {
      const candPayroll = Math.max(0, is.payroll);
      const candRent    = Math.max(0, is.rentExpense);
      const candAdv     = Math.max(0, is.advertising);
      const candDA      = Math.max(0, is.daExpenseStandard);
      const tagged      = is.costsAndExpenses;
      const baseGa      = gaVal > 0 ? gaVal : 0;
      // Reconciliation strategy: try the 4-component sum (G&A + payroll +
      // rent + D&A) first. If it lands within 3 % of tagged OpEx, admit those
      // four and *exclude* advertising — advertising is bundled inside G&A
      // for most issuers (RYOJ tags us-gaap:AdvertisingExpense as a CF / note
      // disclosure, but G&A already includes the same dollars). Only fall
      // back to the 5-component sum when adding advertising actually closes
      // a real gap (issuers where adv sits outside G&A as its own IS line).
      const sum4 = baseGa + candPayroll + candRent + candDA;
      const sum5 = sum4 + candAdv;
      const fit = (sum: number) =>
        tagged > 0 && sum > 0 ? Math.abs(sum - tagged) / tagged : Infinity;
      const fit4 = fit(sum4);
      const fit5 = fit(sum5);
      if (fit4 <= 0.03) {
        payrollVal = candPayroll; rentExpVal = candRent;
        daStdVal   = candDA;       advertisingVal = 0;
      } else if (fit5 <= 0.03 && fit5 < fit4) {
        payrollVal = candPayroll; rentExpVal = candRent;
        daStdVal   = candDA;       advertisingVal = candAdv;
      } else {
        // Fallback A1: D&A standalone. D&A is rarely bundled INSIDE tagged
        // G&A — issuers that bundle it don't tag DepreciationAndAmortization
        // as a separate concept — so admitting it on its own when material is
        // safe even without full reconciliation. Cap by the 1.02× overshoot
        // guard against the tagged total so a CF-reconciliation tag doesn't
        // overflow the parent.
        if (candDA > 0 && tagged > 0
            && rdVal + smVal + baseGa + candDA <= tagged * 1.02) {
          daStdVal = candDA;
        }
        // Fallback A2: when there's NO tagged G&A line, payroll / rent /
        // advertising can't be double-counted against G&A. Admit them as
        // standalone buckets when the cumulative known opex doesn't overshoot.
        // This catches issuers that report the OpEx line items directly
        // without an aggregated SG&A.
        if (gaVal === 0) {
          const cumStd = rdVal + smVal
            + candPayroll + candRent + candAdv + daStdVal;
          if (tagged > 0 && cumStd <= tagged * 1.02) {
            payrollVal     = candPayroll;
            rentExpVal     = candRent;
            advertisingVal = candAdv;
          }
        }
      }
    }

    // Any remaining opex not explained by known line items.
    // Bug fix: `impairmentVal` and `restructuringVal` (computed below) used
    // to be excluded from `knownOpex`, so issuers with tagged impairment got
    // it double-counted as both an `impairment` bucket AND inside `other`.
    // Compute them up-front so they participate in the residual calc.
    const impairmentValRaw    = is.impairment    > 0 ? is.impairment    : 0;
    const restructuringValRaw = is.restructuring > 0 ? is.restructuring : 0;
    // Sanity guard: if surfacing impairment + restructuring would push the
    // sum of all admitted buckets above totalOpex, the tag is likely a CF
    // reconciliation entry (tagged but not on the P&L line) — common for
    // foreign issuers (RYOJ tags us-gaap:ImpairmentOfIntangibles in the CF
    // adjustment block, not as an OpEx line). Drop them rather than create
    // a bucket that overflows the parent OpEx node.
    const admittedSoFar = rdVal + smVal + gaVal
      + fuelVal + laborVal + maintVal + rentLandVal + daVal
      + taxesOtherVal + explorationVal
      + payrollVal + rentExpVal + advertisingVal + daStdVal;
    const wouldOvershoot = totalOpex > 0
      && (admittedSoFar + impairmentValRaw + restructuringValRaw) > totalOpex * 1.02;
    const impairmentVal    = wouldOvershoot ? 0 : impairmentValRaw;
    const restructuringVal = wouldOvershoot ? 0 : restructuringValRaw;

    const knownOpex = rdVal + smVal + gaVal
      + fuelVal + laborVal + maintVal + rentLandVal + daVal
      + taxesOtherVal + explorationVal
      + impairmentVal + restructuringVal
      + payrollVal + rentExpVal + advertisingVal + daStdVal;
    const otherOpex  = knownOpex > 0 ? Math.max(0, totalOpex - knownOpex) : 0;
    // For oil-gas, the residual is the dominant line (crude purchases) —
    // surface it as a labeled "Purchases & Production" bucket instead of
    // letting it fall into the generic "Other OpEx" sink.
    const purchasesVal = isOilGas ? otherOpex : 0;

    // Impairment / restructuring as standalone triggers: issuers with no
    // tagged R&D / S&M / G&A but a material write-down or restructuring
    // charge would otherwise render OpEx as a leaf. Both values already pass
    // the wouldOvershoot guard above, so admitting them here is bounded.
    const hasBankBreakdown = industryProfile === "bank" && (
      is.bankCompensation > 0 || is.bankTechnology > 0 || is.bankProfessional > 0
      || is.bankOccupancy > 0 || is.bankMarketing > 0 || is.bankOtherNoninterest > 0
    );
    const hasBreakdown = rdVal > 0 || smVal > 0 || gaVal > 0 || isAirline
      || (isOilGas && (daVal > 0 || taxesOtherVal > 0 || explorationVal > 0 || purchasesVal > 0))
      || (isPreRevenue && (rdVal > 0 || gaVal > 0 || daVal > 0))
      || payrollVal > 0 || rentExpVal > 0 || advertisingVal > 0 || daStdVal > 0
      || impairmentVal > 0 || restructuringVal > 0
      || hasBankBreakdown;

    // Reconcile tagged dimensional segments with consolidated revenue so the
    // Sankey's input ribbons exactly fill the Revenue node. Two failure modes:
    //   • Undershoot >1% (e.g. ULCC, CCJ Westinghouse missing): real untagged
    //     revenue stream — backfill an "Other" node so it shows up explicitly.
    //     If an "Other" segment already exists in XBRL, fold the gap into it.
    //   • Undershoot ≤1% or any overshoot: rounding noise / minor tagging
    //     reconciliation — scale segments proportionally to match revenue.
    //     Avoids adding a sliver "Other" node for sub-percent gaps while still
    //     closing the visual gap d3-sankey would otherwise leave (the outflow
    //     side gp + cogs is forced to equal rev exactly, so any inflow ≠ rev
    //     leaves dead space at the top of Revenue).
    const rawSegs = segmentResult?.segments ?? [];
    const segSumUSD = rawSegs.reduce((s, x) => s + x.valueUSD, 0);
    const hasSegs = rawSegs.length > 0 && segSumUSD > 0 && is.revenue > 0;
    const undershootUSD = hasSegs ? Math.max(0, is.revenue - segSumUSD) : 0;
    const shouldBackfill = undershootUSD > is.revenue * 0.01;
    const existingOther = shouldBackfill
      ? rawSegs.find((s) => /^other(\s|$|,)/i.test(s.name))
      : undefined;

    let scaledSegs = rawSegs.map((s) => ({
      name: s.name,
      valueUSD: s === existingOther ? s.valueUSD + undershootUSD : s.valueUSD,
      yoy: s.yoy,
    }));
    if (shouldBackfill && !existingOther) {
      scaledSegs.push({ name: "Other", valueUSD: undershootUSD, yoy: undefined });
    }
    // Proportional scaling for sub-1% mismatches (both directions). After the
    // backfill above this only triggers when the residual gap is rounding-level
    // or when segments exceed revenue (e.g. tagged member overlap with negative
    // untagged eliminations rolled into `Revenues`).
    if (hasSegs) {
      const adjustedSum = scaledSegs.reduce((s, x) => s + x.valueUSD, 0);
      if (adjustedSum > 0 && Math.abs(adjustedSum - is.revenue) > is.revenue * 0.001) {
        const factor = is.revenue / adjustedSum;
        scaledSegs = scaledSegs.map((s) => ({ ...s, valueUSD: s.valueUSD * factor }));
      }
    }
    const segments = scaledSegs.map((s) => ({
      name: s.name,
      value: sc(s.valueUSD),
      yoy: s.yoy,
    }));

    // For industries where business segments don't represent how revenue is
    // earned (banks: NII vs noninterest income; asset managers: mgmt fees vs
    // performance; insurance: premiums vs investment income; REITs: rental
    // vs other property income), override `segments` with the
    // industry-specific revenue split so the Sankey's left column matches
    // how investors actually decompose top-line. The standard segment loop
    // in the renderer feeds these straight into the Revenue node.
    if (industryProfile === "bank") {
      const niiNum  = Math.max(0, is.interestIncome - is.interestExpense);
      const nonInc  = Math.max(0, is.noninterestIncome);
      const rawSegs: Array<{ name: string; value: number }> = [];
      if (niiNum > 0) rawSegs.push({ name: "Net Interest Income", value: niiNum });
      if (nonInc > 0) rawSegs.push({ name: "Noninterest Income",  value: nonInc });

      // Reconcile segments with `is.revenue` so the Sankey's left column sums
      // exactly to Revenue. Two failure modes when XBRL `Revenues` mismatches
      // NII + NonintInc:
      //   • Overflow (e.g. BAFN: NII 11.2M > rev 11.1M, negative untagged
      //     noninterest-income items absorbed into `Revenues`) → scale segments
      //     down so the input ribbon doesn't oversize the Revenue node.
      //   • Undershoot (issuer reports `Revenues` covering ancillary income not
      //     in NonintInc, or reverses a noninterest expense as revenue) → add
      //     an "Other Net Revenue" residual to fill the gap.
      const segSum = rawSegs.reduce((s, x) => s + x.value, 0);
      if (segSum > 0 && is.revenue > 0) {
        if (segSum > is.revenue * 1.005) {
          const scale = is.revenue / segSum;
          rawSegs.forEach((s) => { s.value = s.value * scale; });
        } else if (segSum < is.revenue * 0.995) {
          rawSegs.push({ name: "Other Net Revenue", value: is.revenue - segSum });
        }
      }

      if (rawSegs.length >= 1) {
        segments.length = 0;
        for (const s of rawSegs) {
          segments.push({ name: s.name, value: sc(s.value), yoy: undefined });
        }
      }
    } else if (industryProfile === "asset-manager") {
      const overrides: typeof segments = [];
      if (is.managementFees > 0) {
        overrides.push({ name: "Management Fees", value: sc(is.managementFees), yoy: undefined });
      }
      if (is.performanceFees > 0) {
        overrides.push({ name: "Performance Fees", value: sc(is.performanceFees), yoy: undefined });
      }
      // Add residual revenue ("Other Revenue") if mgmt+perf fees don't
      // explain the full top-line — common when the issuer reports advisory
      // fees and other ancillary income.
      const explained = is.managementFees + is.performanceFees;
      if (explained > 0 && is.revenue - explained > is.revenue * 0.05) {
        overrides.push({ name: "Other Revenue", value: sc(is.revenue - explained), yoy: undefined });
      }
      if (overrides.length >= 1) {
        segments.length = 0;
        segments.push(...overrides);
      }
    } else if (industryProfile === "insurance") {
      const overrides: typeof segments = [];
      if (is.premiumsEarned > 0) {
        overrides.push({ name: "Premiums Earned", value: sc(is.premiumsEarned), yoy: undefined });
      }
      const investmentIncome = Math.max(0, is.revenue - is.premiumsEarned);
      if (investmentIncome > is.revenue * 0.05) {
        overrides.push({ name: "Investment Income", value: sc(investmentIncome), yoy: undefined });
      }
      if (overrides.length >= 1) {
        segments.length = 0;
        segments.push(...overrides);
      }
    } else if (industryProfile === "reit") {
      const overrides: typeof segments = [];
      if (is.rentalIncome > 0) {
        overrides.push({ name: "Rental Income", value: sc(is.rentalIncome), yoy: undefined });
      }
      const otherIncome = Math.max(0, is.revenue - is.rentalIncome);
      if (otherIncome > is.revenue * 0.05) {
        overrides.push({ name: "Other Property Income", value: sc(otherIncome), yoy: undefined });
      }
      if (overrides.length >= 1) {
        segments.length = 0;
        segments.push(...overrides);
      }
    }

    // Industry-specific derived values. Each profile populates the fields its
    // renderer needs; standard/services/airline/oil-gas leave them undefined.
    const nii = industryProfile === "bank"
      ? Math.max(0, is.interestIncome - is.interestExpense)
      : undefined;

    // NOI = total revenue (rental + services) − property opex. Using
    // total revenue (not just rentalIncome) makes the Sankey balance: the
    // services slice flows through the same NOI funnel as the rental slice.
    // Property opex isolates the recurring cost of operating the real-estate
    // base — excludes corporate G&A and D&A which are downstream of NOI.
    const noi = industryProfile === "reit" && is.rentalIncome > 0
      ? Math.max(0, is.revenue - Math.max(0, is.costsAndExpenses - is.daExpense - is.generalAdmin))
      : undefined;

    // FFO ≈ Net Income + D&A − Gain on Sale (NAREIT simplified definition).
    // Positive only — losses get rendered separately via netLoss.
    const ffo = industryProfile === "reit"
      ? Math.max(0, is.netIncome + is.daExpense - is.gainLossOnSale)
      : undefined;

    const compensationRatioPct = industryProfile === "asset-manager"
      && is.compensationExpense > 0 && is.revenue > 0
      ? parseFloat(((is.compensationExpense / is.revenue) * 100).toFixed(1))
      : undefined;

    // SBC is excluded because issuers report it as part of the line where the
    // employee sits (most tag SBC AND add it to SG&A); rendering it as a
    // separate bucket would visually double-count those dollars.
    // `impairmentVal` and `restructuringVal` were already computed above (with
    // an overshoot guard so a CF-reconciliation tag — common on RYOJ-style
    // foreign issuers — doesn't materialize as a bucket that overflows the
    // OpEx parent). Reuse them here.
    const sbcVal = 0;

    // Non-operating breakdown — only populate when at least one non-op item
    // is tagged. For banks the interest income/expense belong above the line
    // and are excluded here.
    const nonOpBreakdown = industryProfile !== "bank" && (
      is.interestIncome > 0 || is.interestExpense > 0 || is.gainLossOnSale > 0
    ) ? {
      interestIncome:  is.interestIncome  > 0 ? sc(is.interestIncome)  : undefined,
      interestExpense: is.interestExpense > 0 ? sc(is.interestExpense) : undefined,
      gainLossOnSale:  is.gainLossOnSale  > 0 ? sc(is.gainLossOnSale)  : undefined,
    } : undefined;

    return {
      currency:     is.currency,
      period:       is.period,
      endDate:      is.endDate,
      segmentPeriod: segmentResult?.segmentPeriod,
      source:       isAnnual
                       ? (isForeign ? (foreignFormType ?? "20-F") : "10-K")
                       : "10-Q",
      sourceUrl,
      unit,
      industryProfile,
      segments,
      totalRevenue:        sc(is.revenue),
      totalRevenueYoy:     is.revenueYoy,
      // Oil-gas issuers (XOM, CVX, COP) report a single CostsAndExpenses
      // total that already INCLUDES the CostOfRevenue line — surfacing
      // GP / CoR separately while routing the full opex through a GP→OpEx
      // ribbon overstates GP's outflow (CVX Q1 FY2026: GP=$20.3B but the
      // GP→OpEx link asked for $44.7B, forcing d3-sankey to oversize the
      // GP node and pull the OpEx / Op.Income rects downward by the
      // layout's center-of-mass logic). Zero gp + cogs so the renderer
      // takes the single-step "Op. Costs" path matching the issuer's
      // actual P&L structure.
      grossProfit:         sc(isOilGas ? 0 : gp),
      grossMarginPct:      !isOilGas && gp > 0 ? pct(gp) : undefined,
      costOfRevenue:       sc((isOilGas || gpInconsistent) ? 0 : is.costOfRevenue),
      operatingProfit:     sc(Math.max(0, op)),
      operatingMarginPct:  pct(Math.max(0, op)),
      // Operating LOSS: reported as a positive magnitude when the issuer's
      // OperatingIncomeLoss < 0 (RYOJ FY2025: $755K loss with $119K positive
      // NI driven by a tax benefit). The renderer reads this to choose an
      // op-loss layout that doesn't try to flow GP → Op Income → NI.
      operatingLoss:       is.operatingIncome < 0 ? sc(-is.operatingIncome) : undefined,
      netProfit:           sc(Math.max(0, is.netIncome)),
      netMarginPct:        pct(Math.max(0, is.netIncome)),
      netLoss:             is.netIncome < 0 ? sc(-is.netIncome) : undefined,
      operatingExpenses:   sc(totalOpex),
      opexBreakdown: hasBreakdown ? {
        rd:             rdVal > 0 ? sc(rdVal) : undefined,
        salesMarketing: smVal > 0 ? sc(smVal) : undefined,
        generalAdmin:   gaVal > 0 ? sc(gaVal) : undefined,
        // For oil-gas, the residual is surfaced as `purchases` instead of
        // `other` so the renderer labels it "Purchases & Production".
        other:          (!isOilGas && otherOpex > 0) ? sc(otherOpex) : undefined,
        fuel:           fuelVal > 0 ? sc(fuelVal) : undefined,
        salariesWages:  laborVal > 0 ? sc(laborVal) : undefined,
        maintenance:    maintVal > 0 ? sc(maintVal) : undefined,
        rentAndLanding: rentLandVal > 0 ? sc(rentLandVal) : undefined,
        depreciation:   daVal > 0 ? sc(daVal) : undefined,
        stockBasedComp: sbcVal > 0 ? sc(sbcVal) : undefined,
        impairment:     impairmentVal > 0 ? sc(impairmentVal) : undefined,
        restructuring:  restructuringVal > 0 ? sc(restructuringVal) : undefined,
        taxesOther:     taxesOtherVal > 0 ? sc(taxesOtherVal) : undefined,
        exploration:    explorationVal > 0 ? sc(explorationVal) : undefined,
        purchases:      purchasesVal > 0 ? sc(purchasesVal) : undefined,
        payroll:        payrollVal     > 0 ? sc(payrollVal)     : undefined,
        rentExpense:    rentExpVal     > 0 ? sc(rentExpVal)     : undefined,
        advertising:    advertisingVal > 0 ? sc(advertisingVal) : undefined,
        depreciationStandard: daStdVal > 0 ? sc(daStdVal) : undefined,
        // Bank Noninterest-Expense decomposition (industryProfile === "bank")
        bankCompensation:     is.bankCompensation     > 0 ? sc(is.bankCompensation)     : undefined,
        bankTechnology:       is.bankTechnology       > 0 ? sc(is.bankTechnology)       : undefined,
        bankProfessional:     is.bankProfessional     > 0 ? sc(is.bankProfessional)     : undefined,
        bankOccupancy:        is.bankOccupancy        > 0 ? sc(is.bankOccupancy)        : undefined,
        bankMarketing:        is.bankMarketing        > 0 ? sc(is.bankMarketing)        : undefined,
        bankOtherNoninterest: is.bankOtherNoninterest > 0 ? sc(is.bankOtherNoninterest) : undefined,
      } : undefined,
      // Bank
      interestIncome:         is.interestIncome  > 0 ? sc(is.interestIncome)  : undefined,
      interestExpense:        is.interestExpense > 0 ? sc(is.interestExpense) : undefined,
      netInterestIncome:      nii !== undefined && nii > 0 ? sc(nii) : undefined,
      // Bank IFRS provision fallback: SMFG / MUFG / ITUB tag the IFRS
      // `ImpairmentLossReversalOfImpairmentLossRecognisedInProfitOrLoss`
      // as the bank-equivalent of provision for credit losses. Surface it
      // ONLY when the profile is already classified as `bank` — same
      // concept is used by miners (BHP, RIO) for asset impairments, so
      // we extract it separately and only route it to the provision flow
      // when the bank context is established.
      provisionForLoanLosses: is.provisionForLoanLosses > 0
        ? sc(is.provisionForLoanLosses)
        : (industryProfile === "bank" && is.bankProvisionIFRS > 0
            ? sc(is.bankProvisionIFRS)
            : undefined),
      noninterestIncome:      is.noninterestIncome  > 0 ? sc(is.noninterestIncome)  : undefined,
      noninterestExpense:     is.noninterestExpense > 0 ? sc(is.noninterestExpense) : undefined,
      // Insurance
      premiumsEarned:       is.premiumsEarned       > 0 ? sc(is.premiumsEarned)       : undefined,
      policyholderBenefits: is.policyholderBenefits > 0 ? sc(is.policyholderBenefits) : undefined,
      underwritingExpense:  is.underwritingExpense  > 0 ? sc(is.underwritingExpense)  : undefined,
      // REIT
      rentalIncome: is.rentalIncome > 0 ? sc(is.rentalIncome) : undefined,
      propertyOpex: industryProfile === "reit" && is.costsAndExpenses > 0
                       ? sc(Math.max(0, is.costsAndExpenses - is.daExpense - is.generalAdmin))
                       : undefined,
      noi: noi !== undefined && noi > 0 ? sc(noi) : undefined,
      ffo: ffo !== undefined && ffo > 0 ? sc(ffo) : undefined,
      // Asset manager
      managementFees:      is.managementFees      > 0 ? sc(is.managementFees)      : undefined,
      performanceFees:     is.performanceFees     > 0 ? sc(is.performanceFees)     : undefined,
      compensationExpense: is.compensationExpense > 0 ? sc(is.compensationExpense) : undefined,
      compensationRatioPct,
      nonOpBreakdown,
      geographyOnly: segmentResult?.geographyOnly,
      tax: sc(Math.max(0, is.tax)),
      // Non-operating income = pre-tax income − operating income.
      // Positive when interest/other income makes net income approach operating income.
      nonOperatingIncome: (() => {
        const nonOp = is.incomeBeforeTax - Math.max(0, op);
        return nonOp > Math.max(0, op) * 0.01 ? sc(nonOp) : undefined;
      })(),
    };
  } catch {
    return null;
  }
}
