export interface EarningsQuarter {
  quarter: string;
  epsActual: number | null;
  epsEstimate: number | null;
  surprisePct: number | null;
}

export interface ForwardEstimate {
  period: string;
  epsEstimate: number | null;
  revenueEstimate: number | null;
  growth: number | null;
}

export interface AnalystAction {
  date: string;
  firm: string;
  action: string;
  fromGrade: string;
  toGrade: string;
}

export interface InsiderTransaction {
  date: string;
  name: string;
  relation: string;
  transactionText: string;
  value: number | null;
}

export interface StockData {
  // Identity
  ticker: string;
  companyName: string;
  domain: string | null;
  sector: string | null;
  industry: string | null;
  description: string | null;

  // Currency (ISO code, e.g. "USD", "ARS")
  currency: string | null;

  // Price
  currentPrice: number | null;
  priceChangePercent: number | null;
  fiftyTwoWeekHigh: number | null;
  fiftyTwoWeekLow: number | null;

  // Valuation
  marketCap: number | null;
  trailingPE: number | null;
  forwardPE: number | null;
  trailingEps: number | null;
  priceToBook: number | null;
  priceToSales: number | null;
  enterpriseToEbitda: number | null;
  beta: number | null;

  // Financials (TTM)
  totalRevenue: number | null;
  revenueGrowth: number | null;
  grossMargins: number | null;
  operatingMargins: number | null;
  profitMargins: number | null;
  ebitdaMargins: number | null;
  ebitda: number | null;
  returnOnEquity: number | null;
  returnOnAssets: number | null;
  totalDebt: number | null;
  totalCash: number | null;
  debtToEquity: number | null;
  currentRatio: number | null;
  quickRatio: number | null;
  freeCashflow: number | null;
  operatingCashflow: number | null;
  earningsGrowth: number | null;
  shortPercentOfFloat: number | null;
  sharesOutstanding: number | null;

  // Ownership
  heldPercentInsiders: number | null;
  institutionalOwnership: number | null;

  // Dividend
  dividendYield: number | null;
  payoutRatio: number | null;
  exDividendDate: string | null;

  // Earnings history (last 4 quarters)
  earningsHistory: EarningsQuarter[];

  // Forward estimates
  forwardEstimates: ForwardEstimate[];

  // Calendar
  nextEarningsDate: string | null;

  // Analyst consensus
  recommendationKey: string | null;
  targetMeanPrice: number | null;
  targetHighPrice: number | null;
  targetLowPrice: number | null;
  analystStrongBuy: number;
  analystBuy: number;
  analystHold: number;
  analystSell: number;
  analystStrongSell: number;

  // Recent analyst actions
  analystActions: AnalystAction[];

  // Insider transactions
  insiderTransactions: InsiderTransaction[];

  // Historical prices (1 year, daily closes) for the price chart
  historicalPrices: { time: string; value: number }[] | null;
}
