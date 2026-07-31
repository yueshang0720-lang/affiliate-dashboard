"use client";

import type { SyncLog } from "@/types";

interface SyncStatusProps {
  lastSync: SyncLog | null;
  syncing: boolean;
}

export default function SyncStatus({ lastSync, syncing }: SyncStatusProps) {
  const statusLabel = syncing
    ? "同步中..."
    : lastSync?.status === "success"
      ? "上次同步成功"
      : lastSync?.status === "failed"
        ? "同步失败"
        : "尚未同步";

  const statusColor = syncing
    ? "text-yellow-600 dark:text-yellow-400"
    : lastSync?.status === "success"
      ? "text-green-600 dark:text-green-400"
      : lastSync?.status === "failed"
        ? "text-red-600 dark:text-red-400"
        : "text-gray-400";

  const dotColor = syncing
    ? "bg-yellow-500 animate-pulse"
    : lastSync?.status === "success"
      ? "bg-green-500"
      : lastSync?.status === "failed"
        ? "bg-red-500"
        : "bg-gray-300 dark:bg-gray-600";

  function formatTime(isoStr: string | undefined): string {
    if (!isoStr) return "-";
    try {
      const d = new Date(isoStr + "Z");
      return d.toLocaleString("zh-CN", {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return isoStr;
    }
  }

  return (
    <div className="flex items-center gap-3 text-sm">
      <div className="flex items-center gap-1.5">
        <span className={`w-2 h-2 rounded-full ${dotColor}`} />
        <span className={statusColor}>{statusLabel}</span>
      </div>
      {lastSync?.completedAt && (
        <span className="text-gray-400 dark:text-gray-500">
          {formatTime(lastSync.completedAt)}
        </span>
      )}
      {lastSync?.status === "failed" && lastSync?.errorMessage && (
        <span
          className="text-red-500 text-xs truncate max-w-[200px]"
          title={lastSync.errorMessage}
        >
          {lastSync.errorMessage}
        </span>
      )}
    </div>
  );
}
