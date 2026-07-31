/**
 * Data storage layer
 *
 * Local dev: JSON file on disk
 * Vercel/Prod: In-memory cache (serverless-friendly, sync repopulates on cold start)
 */

import type { UnifiedStats, MatchedRow, SyncLog, DataFilters } from "@/types";

// In-memory store (works everywhere, including Vercel serverless)
let memoryStats: UnifiedStats[] = [];
let memorySyncLogs: SyncLog[] = [];
let nextLogId = 1;

const isVercel = process.env.VERCEL === "1";

// ============================================================
// Local file helpers (only used in development)
// ============================================================

function loadFromFile(): { stats: UnifiedStats[]; logs: SyncLog[] } {
  if (isVercel) return { stats: memoryStats, logs: memorySyncLogs };

  try {
    const path = require("path");
    const fs = require("fs");
    const dir = path.resolve(process.cwd(), "data");
    const statsFile = path.join(dir, "unified_stats.json");
    const logsFile = path.join(dir, "sync_logs.json");

    if (fs.existsSync(statsFile)) {
      memoryStats = JSON.parse(fs.readFileSync(statsFile, "utf-8"));
    }
    if (fs.existsSync(logsFile)) {
      memorySyncLogs = JSON.parse(fs.readFileSync(logsFile, "utf-8"));
      if (memorySyncLogs.length > 0) {
        nextLogId = Math.max(...memorySyncLogs.map((l) => l.id || 0)) + 1;
      }
    }
  } catch {
    // File read failed, use memory
  }
  return { stats: memoryStats, logs: memorySyncLogs };
}

function saveToFile(): void {
  if (isVercel) return;
  try {
    const path = require("path");
    const fs = require("fs");
    const dir = path.resolve(process.cwd(), "data");
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(
      path.join(dir, "unified_stats.json"),
      JSON.stringify(memoryStats, null, 2),
      "utf-8"
    );
    fs.writeFileSync(
      path.join(dir, "sync_logs.json"),
      JSON.stringify(memorySyncLogs, null, 2),
      "utf-8"
    );
  } catch {
    // File write failed, data is still in memory
  }
}

// Init from file on first load
loadFromFile();

// ============================================================
// CRUD operations
// ============================================================

export function upsertStats(stats: UnifiedStats[]): number {
  const map = new Map<string, UnifiedStats>();
  for (const row of memoryStats) {
    map.set(`${row.date}|${row.campaignName}`, row);
  }
  let inserted = 0;
  for (const row of stats) {
    const key = `${row.date}|${row.campaignName}`;
    if (!map.has(key)) inserted++;
    row.lastSyncedAt = new Date().toISOString();
    row.createdAt = row.createdAt || new Date().toISOString();
    map.set(key, row);
  }
  memoryStats = Array.from(map.values());
  saveToFile();
  return stats.length;
}

export function queryStats(filters: DataFilters): {
  rows: MatchedRow[];
  total: number;
} {
  let rows = memoryStats.map(mapToMatchedRow);

  if (filters.startDate) {
    rows = rows.filter((r) => r.date >= filters.startDate!);
  }
  if (filters.endDate) {
    rows = rows.filter((r) => r.date <= filters.endDate!);
  }
  if (filters.campaignSearch) {
    const q = filters.campaignSearch.toLowerCase();
    rows = rows.filter((r) => r.campaignName.toLowerCase().includes(q));
  }
  if (filters.matchStatus && filters.matchStatus !== "all") {
    rows = rows.filter((r) => r.matchStatus === filters.matchStatus);
  }

  const sortBy = filters.sortBy || "date";
  const sortOrder = filters.sortOrder || "desc";
  const multiplier = sortOrder === "asc" ? 1 : -1;

  rows.sort((a, b) => {
    const aVal = (a as unknown as Record<string, unknown>)[sortBy];
    const bVal = (b as unknown as Record<string, unknown>)[sortBy];
    if (typeof aVal === "number" && typeof bVal === "number") {
      return (aVal - bVal) * multiplier;
    }
    return String(aVal || "").localeCompare(String(bVal || "")) * multiplier;
  });

  const total = rows.length;
  const page = filters.page || 1;
  const pageSize = filters.pageSize || 50;
  const start = (page - 1) * pageSize;
  rows = rows.slice(start, start + pageSize);

  return { rows, total };
}

export function getSummaryStats(filters?: {
  startDate?: string;
  endDate?: string;
}): {
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
} {
  let rows = memoryStats.map(mapToMatchedRow);

  if (filters?.startDate) rows = rows.filter((r) => r.date >= filters.startDate!);
  if (filters?.endDate) rows = rows.filter((r) => r.date <= filters.endDate!);

  const totalGaCost = rows.reduce((s, r) => s + r.gaCost, 0);
  const totalGaClicks = rows.reduce((s, r) => s + r.gaClicks, 0);
  const totalGaConversions = rows.reduce((s, r) => s + r.gaConversions, 0);
  const totalAffCommission = rows.reduce((s, r) => s + r.affCommission, 0);
  const totalAffConversions = rows.reduce((s, r) => s + r.affConversions, 0);
  const totalAffOrderValue = rows.reduce((s, r) => s + r.affOrderValue, 0);
  const totalProfit = totalAffCommission - totalGaCost;
  const overallRoi = totalGaCost > 0 ? Math.round((totalProfit / totalGaCost) * 10000) / 100 : 0;
  const matchedRows = rows.filter((r) => r.matchStatus === "matched").length;

  return {
    totalGaCost: Math.round(totalGaCost * 100) / 100,
    totalGaClicks,
    totalGaConversions,
    totalAffCommission: Math.round(totalAffCommission * 100) / 100,
    totalAffConversions,
    totalAffOrderValue: Math.round(totalAffOrderValue * 100) / 100,
    totalProfit: Math.round(totalProfit * 100) / 100,
    overallRoi,
    matchedRows,
    totalRows: rows.length,
  };
}

// ============================================================
// Sync log
// ============================================================

export function createSyncLog(): number {
  const id = nextLogId++;
  memorySyncLogs.push({
    id,
    startedAt: new Date().toISOString(),
    completedAt: null,
    status: "running",
    recordsFetched: 0,
    recordsMatched: 0,
    errorMessage: null,
  });
  saveToFile();
  return id;
}

export function updateSyncLog(
  id: number,
  data: {
    status: "success" | "failed";
    recordsFetched?: number;
    recordsMatched?: number;
    errorMessage?: string;
  }
): void {
  const entry = memorySyncLogs.find((l) => l.id === id);
  if (!entry) return;
  entry.status = data.status;
  entry.completedAt = new Date().toISOString();
  if (data.recordsFetched !== undefined) entry.recordsFetched = data.recordsFetched;
  if (data.recordsMatched !== undefined) entry.recordsMatched = data.recordsMatched;
  if (data.errorMessage !== undefined) entry.errorMessage = data.errorMessage;
  saveToFile();
}

export function getLastSync(): SyncLog | null {
  if (memorySyncLogs.length === 0) return null;
  return memorySyncLogs.reduce((a, b) => ((a.id || 0) > (b.id || 0) ? a : b));
}

export function clearData(): void {
  memoryStats = [];
  memorySyncLogs = [];
  saveToFile();
}

// ============================================================
// Helpers
// ============================================================

function mapToMatchedRow(r: UnifiedStats): MatchedRow {
  const gaClicks = r.gaClicks || 0;
  const gaImpressions = r.gaImpressions || 0;
  const affClicks = r.affClicks || 0;
  const affConversions = r.affConversions || 0;
  const hasGa = gaClicks > 0 || gaImpressions > 0;
  const hasAff = affClicks > 0 || affConversions > 0;

  let matchStatus: MatchedRow["matchStatus"];
  if (hasGa && hasAff) matchStatus = "matched";
  else if (hasGa && !hasAff) matchStatus = "google_only";
  else if (!hasGa && hasAff) matchStatus = "affiliate_only";
  else matchStatus = "matched";

  return { ...r, matchStatus };
}
