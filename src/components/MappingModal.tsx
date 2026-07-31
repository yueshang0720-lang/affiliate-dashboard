"use client";

import { useState, useEffect } from "react";
import type { CampaignMapping } from "@/lib/campaign-mapping";

interface Props {
  open: boolean;
  onClose: () => void;
  onMappingChanged: () => void;
}

export default function MappingModal({ open, onClose, onMappingChanged }: Props) {
  const [mappings, setMappings] = useState<CampaignMapping[]>([]);
  const [gaCampaigns, setGaCampaigns] = useState<string[]>([]);
  const [affCampaigns, setAffCampaigns] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  // New mapping form
  const [selectedGa, setSelectedGa] = useState<string[]>([]);
  const [selectedAff, setSelectedAff] = useState("");

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    fetch("/api/mappings")
      .then((r) => r.json())
      .then((d) => {
        setMappings(d.mappings || []);
        setGaCampaigns(d.gaCampaigns || []);
        setAffCampaigns(d.affCampaigns || []);
      })
      .finally(() => setLoading(false));
  }, [open]);

  async function handleAdd() {
    if (selectedGa.length === 0 || !selectedAff) return;
    const res = await fetch("/api/mappings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        gaCampaignNames: selectedGa,
        affCampaignName: selectedAff,
      }),
    });
    const data = await res.json();
    if (data.success) {
      setMappings((prev) => [...prev, data.mapping]);
      setSelectedGa([]);
      setSelectedAff("");
      onMappingChanged();
    }
  }

  async function handleDelete(id: string) {
    await fetch(`/api/mappings?id=${id}`, { method: "DELETE" });
    setMappings((prev) => prev.filter((m) => m.id !== id));
    onMappingChanged();
  }

  function toggleGa(name: string) {
    setSelectedGa((prev) =>
      prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name]
    );
  }

  // Get used GA names (already in mappings)
  const usedGaNames = new Set(mappings.flatMap((m) => m.gaCampaignNames));
  const availableGa = gaCampaigns.filter((n) => !usedGaNames.has(n));

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white dark:bg-gray-900 rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">
            🔗 广告系列映射
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-xl">✕</button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {loading ? (
            <p className="text-gray-400 text-center py-8">加载中...</p>
          ) : (
            <>
              {/* ── Existing Mappings ── */}
              {mappings.length > 0 && (
                <div className="p-3 rounded-lg border border-gray-200 dark:border-gray-700">
                  <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                    已有映射（{mappings.length}条）
                  </h3>
                  <div className="space-y-1 max-h-48 overflow-y-auto">
                    {mappings.map((m) => (
                      <div
                        key={m.id}
                        className="flex items-center gap-2 text-sm py-1.5 px-2 rounded hover:bg-gray-50 dark:hover:bg-gray-800 group"
                      >
                        <span className="flex-1">
                          <span className="text-blue-600 dark:text-blue-400 font-medium">
                            {m.gaCampaignNames.length}个谷歌系列
                          </span>
                          <span className="text-gray-400 mx-2">→</span>
                          <span className="text-green-600 dark:text-green-400 font-medium">
                            {m.affCampaignName}
                          </span>
                        </span>
                        <button
                          onClick={() => handleDelete(m.id)}
                          className="text-red-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity text-xs"
                        >
                          删除
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ── New Mapping ── */}
              <div className="grid grid-cols-2 gap-4">
                {/* Left: Google Ads campaigns */}
                <div className="p-3 rounded-lg border border-blue-200 dark:border-blue-800">
                  <h3 className="text-sm font-semibold text-blue-700 dark:text-blue-400 mb-2">
                    Google Ads 广告系列
                    <span className="text-xs font-normal text-gray-400 ml-1">
                      （可多选，选{selectedGa.length}个）
                    </span>
                  </h3>
                  <div className="max-h-64 overflow-y-auto space-y-0.5">
                    {availableGa.length === 0 && usedGaNames.size === gaCampaigns.length && gaCampaigns.length > 0 ? (
                      <p className="text-xs text-gray-400">所有谷歌系列已映射</p>
                    ) : (
                      availableGa.map((name) => (
                        <label
                          key={name}
                          className={`flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer text-sm transition-colors ${
                            selectedGa.includes(name)
                              ? "bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-300"
                              : "hover:bg-gray-50 dark:hover:bg-gray-800"
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={selectedGa.includes(name)}
                            onChange={() => toggleGa(name)}
                            className="shrink-0"
                          />
                          <span className="truncate dark:text-gray-300">{name || "(空名称)"}</span>
                        </label>
                      ))
                    )}
                    {gaCampaigns.length === 0 && (
                      <p className="text-xs text-gray-400">暂无 Google Ads 数据，请先同步</p>
                    )}
                  </div>
                </div>

                {/* Right: Affiliate campaigns */}
                <div className="p-3 rounded-lg border border-green-200 dark:border-green-800">
                  <h3 className="text-sm font-semibold text-green-700 dark:text-green-400 mb-2">
                    联盟 Offer / 广告系列
                    <span className="text-xs font-normal text-gray-400 ml-1">（单选）</span>
                  </h3>
                  <div className="max-h-64 overflow-y-auto space-y-0.5">
                    {affCampaigns.map((name) => (
                      <label
                        key={name}
                        className={`flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer text-sm transition-colors ${
                          selectedAff === name
                            ? "bg-green-100 dark:bg-green-900/40 text-green-800 dark:text-green-300"
                            : "hover:bg-gray-50 dark:hover:bg-gray-800"
                        }`}
                      >
                        <input
                          type="radio"
                          name="affCampaign"
                          checked={selectedAff === name}
                          onChange={() => setSelectedAff(name)}
                          className="shrink-0"
                        />
                        <span className="truncate dark:text-gray-300">{name || "(空名称)"}</span>
                      </label>
                    ))}
                    {affCampaigns.length === 0 && (
                      <p className="text-xs text-gray-400">暂无联盟数据，请先同步</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Add button */}
              <button
                onClick={handleAdd}
                disabled={selectedGa.length === 0 || !selectedAff}
                className="w-full py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                {selectedGa.length === 0
                  ? "先在左侧选择谷歌广告系列"
                  : !selectedAff
                    ? "再在右侧选择联盟 Offer"
                    : `将 ${selectedGa.length} 个谷歌系列 → ${selectedAff}`}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
