export type VerdictRating = "BUY" | "HOLD" | "AVOID";
export type VerdictConviction = "HIGH" | "MEDIUM" | "LOW";

export interface SegmentItem {
  name: string;
  value: number;
  yoy?: string;
}

export interface SegmentSankeyData {
  currency: string;
  period: string;
  segmentPeriod?: string;
  unit: string;
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
  };
  investments?: number;
  tax?: number;
  nonOperatingIncome?: number;
}

export interface Verdict {
  rating: VerdictRating;
  conviction: VerdictConviction;
  rationale: string;
}

export interface BullBearCase {
  narrative: string;
  priceTarget: string;
}

export interface StructuredReport {
  businessModel: string;
  revenueStreams: string;
  profitabilityAnalysis: string;
  balanceSheetHealth: string;
  freeCashFlow: string;
  capitalExpenditure: string;
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
