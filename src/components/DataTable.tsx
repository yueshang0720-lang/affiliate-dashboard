"use client";

import { useState, useMemo } from "react";
import type { MatchedRow, MatchStatus } from "@/types";

interface DataTableProps {
  rows: MatchedRow[];
  total: number;
  loading: boolean;
  page: number;
  pageSize: number;
  sortBy: string;
  sortOrder: "asc" | "desc";
  onPageChange: (page: number) => void;
  onSortChange: (column: string) => void;
}

interface ColumnDef {
  key: string;
  label: string;
  group: "google" | "affiliate" | "derived" | "info";
  sortable: boolean;
  format?: (row: MatchedRow) => string;
  className?: string;
}

const COLUMNS: ColumnDef[] = [
  // Info columns
  { key: "date", label: "日期", group: "info", sortable: true },
  {
    key: "campaignName",
    label: "广告系列",
    group: "info",
    sortable: true,
  },
  {
    key: "matchStatus",
    label: "匹配状态",
    group: "info",
    sortable: false,
    format: (r) => {
      const map: Record<MatchStatus, string> = {
        matched: "已匹配",
        google_only: "仅谷歌",
        affiliate_only: "仅联盟",
      };
      return map[r.matchStatus];
    },
  },
  // Google Ads columns
  {
    key: "gaImpressions",
    label: "展示",
    group: "google",
    sortable: true,
    format: (r) => r.gaImpressions.toLocaleString(),
  },
  {
    key: "gaClicks",
    label: "点击",
    group: "google",
    sortable: true,
    format: (r) => r.gaClicks.toLocaleString(),
  },
  {
    key: "gaCost",
    label: "花费",
    group: "google",
    sortable: true,
    format: (r) => `$${r.gaCost.toFixed(2)}`,
  },
  {
    key: "gaConversions",
    label: "转化",
    group: "google",
    sortable: true,
    format: (r) => r.gaConversions.toLocaleString(),
  },
  {
    key: "gaCtr",
    label: "CTR",
    group: "google",
    sortable: true,
    format: (r) => `${r.gaCtr.toFixed(1)}%`,
  },
  {
    key: "gaCpc",
    label: "CPC",
    group: "google",
    sortable: true,
    format: (r) => `$${r.gaCpc.toFixed(2)}`,
  },
  // Affiliate columns
  {
    key: "affClicks",
    label: "点击",
    group: "affiliate",
    sortable: true,
    format: (r) => r.affClicks.toLocaleString(),
  },
  {
    key: "affConversions",
    label: "转化",
    group: "affiliate",
    sortable: true,
    format: (r) => r.affConversions.toLocaleString(),
  },
  {
    key: "affCommission",
    label: "佣金",
    group: "affiliate",
    sortable: true,
    format: (r) => `$${r.affCommission.toFixed(2)}`,
  },
  {
    key: "affOrderValue",
    label: "订单金额",
    group: "affiliate",
    sortable: true,
    format: (r) => `$${r.affOrderValue.toFixed(2)}`,
  },
  {
    key: "affConversionRate",
    label: "转化率",
    group: "affiliate",
    sortable: true,
    format: (r) => `${r.affConversionRate.toFixed(1)}%`,
  },
  // Derived columns
  {
    key: "profit",
    label: "利润",
    group: "derived",
    sortable: true,
    format: (r) => {
      const cls = r.profit >= 0 ? "text-green-600 font-medium" : "text-red-600 font-medium";
      return `$${r.profit.toFixed(2)}`;
    },
    className: "font-medium",
  },
  {
    key: "roi",
    label: "ROI",
    group: "derived",
    sortable: true,
    format: (r) => {
      const cls = r.roi >= 0 ? "text-green-600" : "text-red-600";
      return `${r.roi.toFixed(1)}%`;
    },
  },
];

export default function DataTable({
  rows,
  total,
  loading,
  page,
  pageSize,
  sortBy,
  sortOrder,
  onPageChange,
  onSortChange,
}: DataTableProps) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const [matchFilter, setMatchFilter] = useState<MatchStatus | "all">("all");

  // Filter rows locally by match status (additional to server-side filtering)
  const displayRows = useMemo(() => {
    if (matchFilter === "all") return rows;
    return rows.filter((r) => r.matchStatus === matchFilter);
  }, [rows, matchFilter]);

  function renderSortIcon(colKey: string) {
    if (sortBy !== colKey) {
      return (
        <span className="text-gray-300 dark:text-gray-600 ml-1 select-none">
          ↕
        </span>
      );
    }
    return (
      <span className="text-blue-500 ml-1 select-none">
        {sortOrder === "asc" ? "↑" : "↓"}
      </span>
    );
  }

  function renderCell(row: MatchedRow, col: ColumnDef) {
    if (col.format) {
      return col.format(row);
    }
    const val = (row as unknown as Record<string, unknown>)[col.key];
    return val != null ? String(val) : "-";
  }

  function getMatchBadge(status: MatchStatus) {
    const map: Record<
      MatchStatus,
      { label: string; cls: string }
    > = {
      matched: {
        label: "已匹配",
        cls: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
      },
      google_only: {
        label: "仅谷歌",
        cls: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
      },
      affiliate_only: {
        label: "仅联盟",
        cls: "bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300",
      },
    };
    return map[status];
  }

  const groupStyles: Record<string, string> = {
    info: "bg-gray-50 dark:bg-gray-800",
    google: "bg-blue-50/50 dark:bg-blue-950/30",
    affiliate: "bg-green-50/50 dark:bg-green-950/30",
    derived: "bg-purple-50/50 dark:bg-purple-950/30",
  };

  const groupLabels: Record<string, string> = {
    info: "",
    google: "Google Ads",
    affiliate: "联盟数据",
    derived: "综合指标",
  };

  // Merge columns into groups for header display
  const groupedColumns = COLUMNS.reduce(
    (acc, col) => {
      if (!acc[col.group]) acc[col.group] = [];
      acc[col.group].push(col);
      return acc;
    },
    {} as Record<string, ColumnDef[]>
  );

  return (
    <div>
      {/* Sub-filter */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500 dark:text-gray-400">
            快速筛选:
          </span>
          {(["all", "matched", "google_only", "affiliate_only"] as const).map(
            (s) => (
              <button
                key={s}
                onClick={() => setMatchFilter(s)}
                className={`text-xs px-2 py-0.5 rounded-full border transition-colors ${
                  matchFilter === s
                    ? "bg-blue-600 text-white border-blue-600"
                    : "bg-white text-gray-600 border-gray-300 hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-600"
                }`}
              >
                {s === "all" ? "全部" : getMatchBadge(s as MatchStatus).label}
              </button>
            )
          )}
        </div>
        <span className="text-xs text-gray-400 dark:text-gray-500">
          共 {total} 条记录
          {displayRows.length !== rows.length &&
            ` (当前页筛选后 ${displayRows.length} 条)`}
        </span>
      </div>

      {/* Table */}
      <div className="overflow-x-auto border border-gray-200 dark:border-gray-700 rounded-lg">
        <table className="w-full text-sm">
          {/* Header with group rows */}
          <thead>
            <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-800">
              {Object.entries(groupedColumns).map(([group, cols]) => (
                <th
                  key={group}
                  colSpan={cols.length}
                  className={`px-3 py-1 text-center text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 border-x border-gray-200 dark:border-gray-700 ${groupStyles[group]}`}
                >
                  {groupLabels[group]}
                </th>
              ))}
            </tr>
            <tr className="border-b-2 border-gray-200 dark:border-gray-700">
              {COLUMNS.map((col) => (
                <th
                  key={col.key}
                  onClick={() => col.sortable && onSortChange(col.key)}
                  className={`px-2 py-2 text-xs font-medium text-gray-600 dark:text-gray-300 whitespace-nowrap select-none ${
                    col.sortable
                      ? "cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800"
                      : ""
                  } ${groupStyles[col.group]}`}
                >
                  {col.label}
                  {col.sortable && renderSortIcon(col.key)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td
                  colSpan={COLUMNS.length}
                  className="text-center py-12 text-gray-400"
                >
                  加载中...
                </td>
              </tr>
            ) : displayRows.length === 0 ? (
              <tr>
                <td
                  colSpan={COLUMNS.length}
                  className="text-center py-12 text-gray-400"
                >
                  暂无数据。请先配置 API 密钥并点击"立即同步"。
                </td>
              </tr>
            ) : (
              displayRows.map((row, idx) => (
                <tr
                  key={row.id ?? idx}
                  className={`border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors ${
                    row.matchStatus === "google_only"
                      ? "bg-blue-50/20 dark:bg-blue-950/10"
                      : row.matchStatus === "affiliate_only"
                        ? "bg-orange-50/20 dark:bg-orange-950/10"
                        : ""
                  }`}
                >
                  {COLUMNS.map((col) => {
                    const val = renderCell(row, col);
                    const align =
                      col.key === "date" ||
                      col.key === "campaignName" ||
                      col.key === "matchStatus"
                        ? "text-left"
                        : "text-right";
                    const isProfit =
                      col.key === "profit" || col.key === "roi";
                    const profitColor =
                      isProfit && row.profit >= 0
                        ? "text-green-600 dark:text-green-400"
                        : isProfit && row.profit < 0
                          ? "text-red-600 dark:text-red-400"
                          : "";

                    return (
                      <td
                        key={col.key}
                        className={`px-2 py-1.5 whitespace-nowrap text-gray-700 dark:text-gray-200 ${align} ${profitColor} ${col.className || ""}`}
                      >
                        {col.key === "matchStatus" ? (
                          <span
                            className={`text-xs px-1.5 py-0.5 rounded-full ${
                              getMatchBadge(row.matchStatus).cls
                            }`}
                          >
                            {val}
                          </span>
                        ) : (
                          val
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between mt-3 text-sm">
        <div className="text-gray-500 dark:text-gray-400">
          第 {page} / {totalPages} 页
        </div>
        <div className="flex gap-1">
          <button
            onClick={() => onPageChange(1)}
            disabled={page <= 1}
            className="px-2 py-1 rounded border border-gray-300 dark:border-gray-600 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-gray-800 dark:text-white text-xs"
          >
            首页
          </button>
          <button
            onClick={() => onPageChange(page - 1)}
            disabled={page <= 1}
            className="px-2 py-1 rounded border border-gray-300 dark:border-gray-600 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-gray-800 dark:text-white text-xs"
          >
            上一页
          </button>
          {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
            let pageNum: number;
            if (totalPages <= 5) {
              pageNum = i + 1;
            } else if (page <= 3) {
              pageNum = i + 1;
            } else if (page >= totalPages - 2) {
              pageNum = totalPages - 4 + i;
            } else {
              pageNum = page - 2 + i;
            }
            return (
              <button
                key={pageNum}
                onClick={() => onPageChange(pageNum)}
                className={`px-2 py-1 rounded border text-xs ${
                  pageNum === page
                    ? "bg-blue-600 text-white border-blue-600"
                    : "border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800 dark:text-white"
                }`}
              >
                {pageNum}
              </button>
            );
          })}
          <button
            onClick={() => onPageChange(page + 1)}
            disabled={page >= totalPages}
            className="px-2 py-1 rounded border border-gray-300 dark:border-gray-600 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-gray-800 dark:text-white text-xs"
          >
            下一页
          </button>
          <button
            onClick={() => onPageChange(totalPages)}
            disabled={page >= totalPages}
            className="px-2 py-1 rounded border border-gray-300 dark:border-gray-600 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-gray-800 dark:text-white text-xs"
          >
            末页
          </button>
        </div>
      </div>
    </div>
  );
}
