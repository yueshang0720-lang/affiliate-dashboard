// ============================================================
// Google Ads raw data from API
// ============================================================
export interface GoogleAdsMetrics {
  date: string; // YYYY-MM-DD
  campaignId: string;
  campaignName: string;
  impressions: number;
  clicks: number;
  cost: number; // in account currency
  conversions: number;
  ctr: number; // click-through rate (clicks / impressions)
  cpc: number; // cost per click (cost / clicks)
}

// ============================================================
// Affiliate raw data from API
// ============================================================
export interface AffiliateMetrics {
  date: string; // YYYY-MM-DD
  campaignId: string;
  campaignName: string;
  clicks: number;
  conversions: number;
  commission: number; // total commission earned
  orderValue: number; // total order/sales value
  conversionRate: number; // conversions / clicks
}

// ============================================================
// Unified / matched row stored in DB and displayed in table
// ============================================================
export interface UnifiedStats {
  id?: number;
  date: string;
  campaignName: string;
  campaignId: string;

  // Google Ads side
  gaImpressions: number;
  gaClicks: number;
  gaCost: number;
  gaConversions: number;
  gaCtr: number;
  gaCpc: number;

  // Affiliate side
  affClicks: number;
  affConversions: number;
  affCommission: number;
  affOrderValue: number;
  affConversionRate: number;

  // Derived
  roi: number; // (commission - cost) / cost (may be Infinity when cost=0)
  profit: number; // commission - cost

  lastSyncedAt?: string;
  createdAt?: string;
}

// ============================================================
// Match result grouping
// ============================================================
export type MatchStatus = "matched" | "google_only" | "affiliate_only";

export interface MatchedRow extends UnifiedStats {
  matchStatus: MatchStatus;
}

// ============================================================
// Sync log
// ============================================================
export interface SyncLog {
  id?: number;
  startedAt: string;
  completedAt: string | null;
  status: "running" | "success" | "failed";
  recordsFetched: number;
  recordsMatched: number;
  errorMessage: string | null;
}

// ============================================================
// Summary stats for KPI cards
// ============================================================
export interface SummaryStats {
  totalGaCost: number;
  totalGaClicks: number;
  totalGaConversions: number;
  totalAffCommission: number;
  totalAffConversions: number;
  totalAffOrderValue: number;
  totalProfit: number;
  overallRoi: number;
  matchedRows: number;
  totalRows: number;
}

// ============================================================
// API route types
// ============================================================
export interface SyncResponse {
  success: boolean;
  message: string;
  syncLogId?: number;
}

export interface DataResponse {
  rows: MatchedRow[];
  total: number;
}

export interface StatsResponse {
  summary: SummaryStats;
  lastSync: SyncLog | null;
}

// ============================================================
// Filter parameters
// ============================================================
export interface DataFilters {
  startDate?: string;
  endDate?: string;
  campaignSearch?: string;
  matchStatus?: MatchStatus | "all";
  sortBy?: string;
  sortOrder?: "asc" | "desc";
  page?: number;
  pageSize?: number;
}
