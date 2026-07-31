"use client";

import { useState, useMemo } from "react";
import type { MatchStatus } from "@/types";
import type { GoogleAdsAccount } from "@/lib/google-ads-client";

interface FilterBarProps {
  onSync: () => void;
  onFilterChange: (filters: FilterState) => void;
  syncing: boolean;
  accounts: GoogleAdsAccount[];
  selectedMccId: string;
  selectedAccountId: string;
  onMccChange: (mccId: string) => void;
  onAccountChange: (accountId: string) => void;
  accountsLoading: boolean;
}

export interface FilterState {
  startDate: string;
  endDate: string;
  campaignSearch: string;
  matchStatus: MatchStatus | "all";
}

export default function FilterBar({
  onSync,
  onFilterChange,
  syncing,
  accounts,
  selectedMccId,
  selectedAccountId,
  onMccChange,
  onAccountChange,
  accountsLoading,
}: FilterBarProps) {
  // Default: last 30 days
  const today = new Date();
  const thirtyDaysAgo = new Date(today);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const [startDate, setStartDate] = useState(
    thirtyDaysAgo.toISOString().split("T")[0]
  );
  const [endDate, setEndDate] = useState(today.toISOString().split("T")[0]);
  const [campaignSearch, setCampaignSearch] = useState("");
  const [matchStatus, setMatchStatus] = useState<MatchStatus | "all">("all");

  function apply() {
    onFilterChange({ startDate, endDate, campaignSearch, matchStatus });
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") apply();
  }

  // Build cascading hierarchy
  const managers = accounts.filter((a) => a.isManager);
  const subAccounts = useMemo(
    () => (selectedMccId ? accounts.filter((a) => !a.isManager && a.parentMccId === selectedMccId) : []),
    [accounts, selectedMccId]
  );
  const hasAccounts = accounts.length > 0;

  return (
    <div className="flex flex-wrap items-center gap-3 mb-4 bg-white dark:bg-gray-900 p-3 rounded-lg border border-gray-200 dark:border-gray-700">
      {/* MCC Selector (Level 1) */}
      <div className="flex items-center gap-2">
        <label className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">MCC</label>
        <select
          value={selectedMccId}
          onChange={(e) => onMccChange(e.target.value)}
          disabled={accountsLoading || !hasAccounts}
          className="border rounded px-2 py-1 text-sm bg-white dark:bg-gray-800 dark:border-gray-600 dark:text-white max-w-[200px]"
        >
          {accountsLoading ? (
            <option value="">加载中...</option>
          ) : !hasAccounts ? (
            <option value="">请先配置API</option>
          ) : (
            <>
              <option value="">选择MCC</option>
              {managers.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name} ({m.id})
                </option>
              ))}
            </>
          )}
        </select>
      </div>

      {/* Sub-account Selector (Level 2) */}
      <div className="flex items-center gap-2">
        <label className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">子账户</label>
        <select
          value={selectedAccountId}
          onChange={(e) => onAccountChange(e.target.value)}
          disabled={!selectedMccId || subAccounts.length === 0}
          className="border rounded px-2 py-1 text-sm bg-white dark:bg-gray-800 dark:border-gray-600 dark:text-white max-w-[240px]"
        >
          {!selectedMccId ? (
            <option value="">先选MCC</option>
          ) : subAccounts.length === 0 ? (
            <option value="">无子账户</option>
          ) : (
            <>
              <option value="">全部子账户</option>
              {subAccounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name} ({a.id})
                </option>
              ))}
            </>
          )}
        </select>
      </div>

      {/* Date Range */}
      <div className="flex items-center gap-2">
        <label className="text-xs text-gray-500 dark:text-gray-400">
          日期
        </label>
        <input
          type="date"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
          onKeyDown={handleKeyDown}
          className="border rounded px-2 py-1 text-sm bg-white dark:bg-gray-800 dark:border-gray-600 dark:text-white"
        />
        <span className="text-gray-400">-</span>
        <input
          type="date"
          value={endDate}
          onChange={(e) => setEndDate(e.target.value)}
          onKeyDown={handleKeyDown}
          className="border rounded px-2 py-1 text-sm bg-white dark:bg-gray-800 dark:border-gray-600 dark:text-white"
        />
      </div>

      {/* Campaign Search */}
      <div className="flex items-center gap-2">
        <label className="text-xs text-gray-500 dark:text-gray-400">
          系列
        </label>
        <input
          type="text"
          value={campaignSearch}
          onChange={(e) => setCampaignSearch(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="搜索..."
          className="border rounded px-2 py-1 text-sm w-28 bg-white dark:bg-gray-800 dark:border-gray-600 dark:text-white dark:placeholder-gray-500"
        />
      </div>

      {/* Match Status */}
      <div className="flex items-center gap-2">
        <label className="text-xs text-gray-500 dark:text-gray-400">
          匹配
        </label>
        <select
          value={matchStatus}
          onChange={(e) =>
            setMatchStatus(e.target.value as MatchStatus | "all")
          }
          className="border rounded px-2 py-1 text-sm bg-white dark:bg-gray-800 dark:border-gray-600 dark:text-white"
        >
          <option value="all">全部</option>
          <option value="matched">已匹配</option>
          <option value="google_only">仅谷歌</option>
          <option value="affiliate_only">仅联盟</option>
        </select>
      </div>

      {/* Apply Filter */}
      <button
        onClick={apply}
        className="px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded border border-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 dark:border-gray-600 dark:text-white transition-colors"
      >
        筛选
      </button>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Sync Button */}
      <button
        onClick={onSync}
        disabled={syncing}
        className={`px-4 py-1.5 text-sm font-medium rounded text-white transition-colors ${
          syncing
            ? "bg-gray-400 cursor-not-allowed"
            : "bg-blue-600 hover:bg-blue-700"
        }`}
      >
        {syncing ? "同步中..." : "立即同步"}
      </button>
    </div>
  );
}
