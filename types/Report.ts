export type VerdictRating = "BUY" | "HOLD" | "AVOID";
export type VerdictConviction = "HIGH" | "MEDIUM" | "LOW";

export interface SegmentItem {
  name: string;
  value: number;
  yoy?: string;
}

export type SankeyDataSource = "10-Q" | "10-K" | "20-F" | "40-F" | "8-K" | "6-K" | "Yahoo";

// Industry-specific render branch. Detected from the income-statement concept
// signature (see lib/fetchSegmentData.ts:detectIndustryProfile). The renderer
// dispatches to a different layout for each value — banks have an NII waterfall,
// REITs have an NOI waterfall, etc. "standard" is the default GP→OpInc→NI chain.
export type IndustryProfile =
  | "standard"      // has COGS + GP + OpInc (most issuers)
  | "services"      // no COGS but OpInc > 0 (V, MA, ADP)
  | "airline"       // fuel + labor as top-level expense lines
  | "oil-gas"       // OpIncomeLoss not tagged; uses IBT as proxy
  | "bank"          // Interest Income + Provision for Loan Losses
  | "insurance"     // Premiums Earned + Policyholder Benefits
  | "reit"          // Rental Income dominates; D&A heavy
  | "asset-manager" // Management/Performance fees + high comp ratio
  | "biotech"       // R&D > revenue or huge R&D burn with NI loss
  | "pre-revenue"   // Rev = 0 but operating costs + net loss reported (NEXT-style LNG developers, dev-stage)
  | "holding";      // Many segments + corporate overhead (BRK-style)

export interface SegmentSankeyData {
  currency: string;
  period: string;
  endDate?: string; // YYYY-MM-DD — quarter/fiscal-year end from EDGAR XBRL
  segmentPeriod?: string;
  source?: SankeyDataSource;
  // SEC EDGAR filing index URL (Archives/edgar/.../{accession}-index.htm).
  // Only set for EDGAR-sourced sankeys (10-K/10-Q/20-F/40-F/8-K/6-K); the
  // Yahoo-TTM stub leaves it undefined. Renderer turns the source label into
  // a clickable attribution link when present.
  sourceUrl?: string;
  unit: string;
  industryProfile?: IndustryProfile;
  segments: SegmentItem[];
  totalRevenue: number;
  totalRevenueYoy?: string;
  grossProfit: number;
  grossMarginPct?: number;
  grossMarginYoy?: string;
  costOfRevenue: number;
  operatingProfit: number;
  operatingMarginPct?: number;
  netProfit: number;
  netMarginPct?: number;
  operatingExpenses: number;
  opexBreakdown?: {
    rd?: number;
    salesMarketing?: number;
    generalAdmin?: number;
    other?: number;
    // Airline-specific buckets — populated when both fuel and labor are
    // reported as top-level expense lines (US carriers: AAL, DAL, UAL, LUV...).
    fuel?: number;
    salariesWages?: number;
    maintenance?: number;
    rentAndLanding?: number;
    depreciation?: number;
    // Cross-industry sub-buckets, populated when XBRL tags them.
    stockBasedComp?: number;
    impairment?: number;
    restructuring?: number;
    // Oil & gas-specific buckets (industryProfile = "oil-gas"). Integrated
    // majors (XOM, CVX) and E&Ps tag these alongside CostsAndExpenses; the
    // residual (`purchases`) covers crude/product purchases + production &
    // manufacturing expenses, which aren't broken out as separate XBRL tags.
    taxesOther?: number;
    exploration?: number;
    purchases?: number;
    // Standard-profile opex sub-buckets — surfaced when the issuer breaks
    // OpEx into Payroll + Rent + Advertising + D&A as separate IS lines that
    // reconcile to the tagged us-gaap:OperatingExpenses total. Common on
    // foreign-private issuers (RYOJ) and some US small-caps.
    payroll?: number;
    rentExpense?: number;
    advertising?: number;
    // Standard-profile D&A as its own bucket. Distinct from `depreciation`
    // (airline / oil-gas / pre-revenue paths) so we don't accidentally render
    // it twice when a profile reclassifies.
    depreciationStandard?: number;
    // Bank-profile Noninterest-Expense decomposition. Surfaced as sub-nodes
    // off the "Noninterest Exp." parent in the bank-profile renderer when
    // the issuer tags these IS lines (JPM / BAC / WFC / C / RF, ...). Sum
    // of populated buckets ≤ noninterestExpense; remainder shows as
    // "Other" inside the bank parent.
    bankCompensation?: number;
    bankTechnology?: number;
    bankProfessional?: number;
    bankOccupancy?: number;
    bankMarketing?: number;
    bankOtherNoninterest?: number;
  };
  // Bank-specific (industryProfile = "bank")
  interestIncome?: number;
  interestExpense?: number;
  netInterestIncome?: number;
  provisionForLoanLosses?: number;
  noninterestIncome?: number;
  noninterestExpense?: number;
  // Insurance-specific (industryProfile = "insurance")
  premiumsEarned?: number;
  policyholderBenefits?: number;
  underwritingExpense?: number;
  // REIT-specific (industryProfile = "reit")
  rentalIncome?: number;
  propertyOpex?: number;
  noi?: number;
  ffo?: number;
  // Asset-manager-specific (industryProfile = "asset-manager")
  managementFees?: number;
  performanceFees?: number;
  compensationExpense?: number;
  compensationRatioPct?: number;
  // Non-operating breakdown — rendered as separate brazos del nodo Non-Op.
  nonOpBreakdown?: {
    interestIncome?: number;
    interestExpense?: number;
    gainLossOnSale?: number;
    other?: number;
  };
  // Flag set when segments come from StatementGeographicalAxis fallback
  // instead of business segments / product axis. Renderer can label "Revenue
  // by region" instead of "Revenue by segment".
  geographyOnly?: boolean;
  investments?: number;
  tax?: number;
  nonOperatingIncome?: number;
  // Positive amount of net loss when the period reported a loss (NI < 0).
  // Set in addition to (not instead of) netProfit, which stays clamped to 0.
  netLoss?: number;
  // Positive amount of operating loss when the issuer's OperatingIncomeLoss < 0.
  // Set independently of netLoss — RYOJ FY2025 reported a $755K operating
  // loss but +$119K net income (driven by a tax benefit). The renderer reads
  // this to choose an op-loss layout instead of the standard GP→OpInc→NI flow.
  operatingLoss?: number;
}

export interface Verdict {
  rating: VerdictRating;
  conviction: VerdictConviction;
  rationale: string;
  // 12-month price target derived by the model from financials, multiples
  // and forward estimates. NOT the analyst consensus mean — that's
  // stockData.targetMeanPrice. The hero displays this one as "Target casa";
  // analyst consensus is shown separately on the Wall Street panel.
  priceTarget: string;
  // Ya no se genera ni se muestra: publicar instrucciones de asignación de
  // cartera chocaba con el régimen de oferta pública (Ley 18.627) — el sizing
  // vive en la conversación con el asesor. Opcional porque los reportes
  // cacheados en D1 todavía lo traen.
  sizing?: string;
}

export interface BullBearCase {
  narrative: string;
  priceTarget: string;
  // Probability of this scenario materializing in the next 12 months, as a
  // string number 0-100. bullCase.probability + bearCase.probability must be
  // ≤ 100; the remainder is the base case probability (verdict scenario).
  // Used to compute expected value and risk/reward asymmetry.
  probability: string;
}

export interface StructuredReport {
  // Key debate: 1 paragraph (~120 words) framing the central contested
  // question on this stock — what alcistas believe, what bajistas believe,
  // and our reading of who is right. Sits between the verdict and the
  // business description. Sharpens "why this view" beyond just rationale.
  keyDebate: string;
  businessModel: string;
  revenueStreams: string;
  profitabilityAnalysis: string;
  balanceSheetHealth: string;
  freeCashFlow: string;
  capitalExpenditure: string;
  // Capital allocation track record (historical TSR-focused analysis):
  // 3-5 year history of how the company deployed cash — buyback execution
  // (share count reduction), dividend growth rate, M&A track record,
  // reinvestment intensity. Distinct from freeCashFlow which is about
  // current generation. This is rear-view: "did management create value
  // with the cash they had?"
  capitalAllocation: string;
  competitiveAdvantages: string;
  managementQuality: string;
  valuationSnapshot: string;
  recentEarnings: string;
  riskFactors: string;
  catalysts: string;
  industryContext: string;
  bullCase: BullBearCase;
  bearCase: BullBearCase;
  verdict: Verdict;
  segmentData?: SegmentSankeyData | null;
}
