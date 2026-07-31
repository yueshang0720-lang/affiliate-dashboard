"use client";

import { useState, useEffect, useCallback } from "react";
import DataTable from "@/components/DataTable";
import FilterBar, { type FilterState } from "@/components/FilterBar";
import KpiCards from "@/components/KpiCards";
import SyncStatus from "@/components/SyncStatus";
import SettingsModal from "@/components/SettingsModal";
import type {
  MatchedRow,
  SummaryStats,
  SyncLog,
  SyncResponse,
  DataResponse,
  StatsResponse,
  MatchStatus,
} from "@/types";
import type { GoogleAdsAccount } from "@/lib/google-ads-client";

const PAGE_SIZE = 50;

export default function Home() {
  // Data state
  const [rows, setRows] = useState<MatchedRow[]>([]);
  const [total, setTotal] = useState(0);
  const [summary, setSummary] = useState<SummaryStats | null>(null);
  const [lastSync, setLastSync] = useState<SyncLog | null>(null);

  // Accounts state
  const [accounts, setAccounts] = useState<GoogleAdsAccount[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState("");
  const [accountsLoading, setAccountsLoading] = useState(false);

  // UI state
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState("date");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [filters, setFilters] = useState<FilterState>({
    startDate: "",
    endDate: "",
    campaignSearch: "",
    matchStatus: "all",
  });

  // Load accounts list
  const fetchAccounts = useCallback(async () => {
    setAccountsLoading(true);
    try {
      const res = await fetch("/api/accounts");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setAccounts(data.accounts || []);
      if (data.selectedAccountId) {
        setSelectedAccountId(data.selectedAccountId);
      }
    } catch (error) {
      console.error("Failed to fetch accounts:", error);
    } finally {
      setAccountsLoading(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    fetchAccounts();
  }, [fetchAccounts]);

  // Fetch data from API
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.startDate) params.set("startDate", filters.startDate);
      if (filters.endDate) params.set("endDate", filters.endDate);
      if (filters.campaignSearch)
        params.set("campaignSearch", filters.campaignSearch);
      if (filters.matchStatus && filters.matchStatus !== "all")
        params.set("matchStatus", filters.matchStatus);
      params.set("sortBy", sortBy);
      params.set("sortOrder", sortOrder);
      params.set("page", String(page));
      params.set("pageSize", String(PAGE_SIZE));

      const res = await fetch(`/api/data?${params.toString()}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: DataResponse = await res.json();
      setRows(data.rows);
      setTotal(data.total);
    } catch (error) {
      console.error("Failed to fetch data:", error);
    } finally {
      setLoading(false);
    }
  }, [filters, sortBy, sortOrder, page]);

  // Fetch summary stats
  const fetchStats = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (filters.startDate) params.set("startDate", filters.startDate);
      if (filters.endDate) params.set("endDate", filters.endDate);

      const res = await fetch(`/api/stats?${params.toString()}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: StatsResponse = await res.json();
      setSummary(data.summary);
      setLastSync(data.lastSync);
    } catch (error) {
      console.error("Failed to fetch stats:", error);
    }
  }, [filters]);

  useEffect(() => {
    fetchData();
    fetchStats();
  }, [fetchData, fetchStats]);

  // Refresh accounts after settings change (when modal closes)
  const handleSettingsClose = useCallback(() => {
    setSettingsOpen(false);
    // Refresh account list in case Google Ads config has changed
    fetchAccounts();
  }, [fetchAccounts]);

  // Handle account change
  const handleAccountChange = useCallback(
    async (accountId: string) => {
      setSelectedAccountId(accountId);
      // Persist selection to settings
      try {
        await fetch("/api/accounts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ accountId }),
        });
      } catch (error) {
        console.error("Failed to save account selection:", error);
      }
    },
    []
  );

  // Handle sync
  const handleSync = async () => {
    setSyncing(true);
    try {
      const res = await fetch("/api/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          startDate: filters.startDate || undefined,
          endDate: filters.endDate || undefined,
          accountId: selectedAccountId || undefined,
        }),
      });
      const data: SyncResponse = await res.json();

      if (data.success) {
        await Promise.all([fetchData(), fetchStats()]);
        alert(`同步成功！${data.message}`);
      } else {
        alert(`同步失败: ${data.message}`);
      }
    } catch (error) {
      alert(
        `同步出错: ${error instanceof Error ? error.message : "未知错误"}`
      );
      await Promise.all([fetchData(), fetchStats()]);
    } finally {
      setSyncing(false);
    }
  };

  // Handle filter changes
  const handleFilterChange = (newFilters: FilterState) => {
    setFilters(newFilters);
    setPage(1);
  };

  // Handle sort
  const handleSortChange = (column: string) => {
    if (sortBy === column) {
      setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(column);
      setSortOrder("desc");
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900">
      <div className="max-w-[1400px] mx-auto px-4 py-6">
        {/* Header */}
        <header className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">
              📊 联盟营销数据统计
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
              Google Ads × 联盟平台数据对比
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSettingsOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 dark:text-white transition-colors"
              title="API 设置"
            >
              ⚙️ 设置
            </button>
            <SyncStatus lastSync={lastSync} syncing={syncing} />
          </div>
        </header>

        {/* KPI Cards */}
        <KpiCards stats={summary} loading={loading && !summary} />

        {/* Filters */}
        <FilterBar
          onSync={handleSync}
          onFilterChange={handleFilterChange}
          syncing={syncing}
          accounts={accounts}
          selectedAccountId={selectedAccountId}
          onAccountChange={handleAccountChange}
          accountsLoading={accountsLoading}
        />

        {/* Data Table */}
        <DataTable
          rows={rows}
          total={total}
          loading={loading}
          page={page}
          pageSize={PAGE_SIZE}
          sortBy={sortBy}
          sortOrder={sortOrder}
          onPageChange={setPage}
          onSortChange={handleSortChange}
        />

        {/* Settings Modal */}
        <SettingsModal
          open={settingsOpen}
          onClose={handleSettingsClose}
        />
      </div>
    </div>
  );
}
