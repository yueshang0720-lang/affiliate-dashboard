"use client";

import type { SummaryStats } from "@/types";

interface KpiCardsProps {
  stats: SummaryStats | null;
  loading: boolean;
}

export default function KpiCards({ stats, loading }: KpiCardsProps) {
  const cards = [
    {
      label: "广告花费",
      value: stats ? `$${stats.totalGaCost.toFixed(2)}` : "-",
      sub: `${stats?.totalGaClicks.toLocaleString() ?? "-"} 点击`,
      color: "blue",
    },
    {
      label: "联盟佣金",
      value: stats ? `$${stats.totalAffCommission.toFixed(2)}` : "-",
      sub: `${stats?.totalAffConversions.toLocaleString() ?? "-"} 转化`,
      color: "green",
    },
    {
      label: "利润",
      value: stats
        ? `$${stats.totalProfit.toFixed(2)}`
        : "-",
      sub: `ROI ${stats?.overallRoi ?? "-"}%`,
      color: stats && stats.totalProfit >= 0 ? "emerald" : "red",
    },
    {
      label: "订单金额",
      value: stats ? `$${stats.totalAffOrderValue.toFixed(2)}` : "-",
      sub: `${stats?.matchedRows ?? "-"} / ${stats?.totalRows ?? "-"} 已匹配`,
      color: "purple",
    },
  ];

  const colorMap: Record<string, string> = {
    blue: "bg-blue-50 border-blue-200 dark:bg-blue-950 dark:border-blue-800",
    green: "bg-green-50 border-green-200 dark:bg-green-950 dark:border-green-800",
    emerald:
      "bg-emerald-50 border-emerald-200 dark:bg-emerald-950 dark:border-emerald-800",
    red: "bg-red-50 border-red-200 dark:bg-red-950 dark:border-red-800",
    purple:
      "bg-purple-50 border-purple-200 dark:bg-purple-950 dark:border-purple-800",
  };

  const textColorMap: Record<string, string> = {
    blue: "text-blue-700 dark:text-blue-300",
    green: "text-green-700 dark:text-green-300",
    emerald: "text-emerald-700 dark:text-emerald-300",
    red: "text-red-700 dark:text-red-300",
    purple: "text-purple-700 dark:text-purple-300",
  };

  const subColorMap: Record<string, string> = {
    blue: "text-blue-500 dark:text-blue-400",
    green: "text-green-500 dark:text-green-400",
    emerald: "text-emerald-500 dark:text-emerald-400",
    red: "text-red-500 dark:text-red-400",
    purple: "text-purple-500 dark:text-purple-400",
  };

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      {cards.map((card) => (
        <div
          key={card.label}
          className={`rounded-xl border p-4 ${colorMap[card.color]} ${loading ? "opacity-50 animate-pulse" : ""}`}
        >
          <div className={`text-sm font-medium ${textColorMap[card.color]}`}>
            {card.label}
          </div>
          <div className="text-2xl font-bold mt-1 text-gray-900 dark:text-white">
            {loading ? "..." : card.value}
          </div>
          <div className={`text-xs mt-1 ${subColorMap[card.color]}`}>
            {loading ? "..." : card.sub}
          </div>
        </div>
      ))}
    </div>
  );
}
