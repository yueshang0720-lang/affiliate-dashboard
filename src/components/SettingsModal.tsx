"use client";

import { useState, useEffect } from "react";
import type { AppSettings } from "@/lib/settings";

interface SettingsModalProps {
  open: boolean;
  onClose: () => void;
}

type TabKey = "google" | "affiliate" | "sync";

const TAB_LABELS: Record<TabKey, string> = {
  google: "Google Ads",
  affiliate: "联盟 API",
  sync: "同步设置",
};

const INITIAL: AppSettings = {
  googleAdsProxyApiKey: "",
  googleAdsClientId: "",
  googleAdsClientSecret: "",
  googleAdsDeveloperToken: "",
  googleAdsRefreshToken: "",
  googleAdsCustomerId: "",
  googleAdsLoginCustomerId: "",
  affiliatePlatform: "mock",
  affiliateApiUrl: "",
  affiliateApiKey: "",
  affiliateApiHeaders: "",
  affiliateDataPath: "data",
  affiliateFieldMapping: "",
  affiliateQueryParams: "",
  googleAdsAuthStatus: "",
  googleAdsSelectedAccountId: "",
  syncIntervalMinutes: "1440",
};

export default function SettingsModal({ open, onClose }: SettingsModalProps) {
  const [tab, setTab] = useState<TabKey>("google");
  const [settings, setSettings] = useState<AppSettings>(INITIAL);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setMessage("");
    fetch("/api/settings")
      .then((r) => r.json())
      .then((data) => setSettings({ ...INITIAL, ...data }))
      .catch(() => setMessage("加载设置失败"))
      .finally(() => setLoading(false));
  }, [open]);

  async function handleSave() {
    setSaving(true);
    setMessage("");
    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      const data = await res.json();
      setMessage(data.success ? "✅ 设置已保存！" : `❌ 保存失败: ${data.message}`);
    } catch {
      setMessage("❌ 保存失败");
    } finally {
      setSaving(false);
    }
  }

  function update(field: keyof AppSettings, value: string) {
    setSettings((prev) => ({ ...prev, [field]: value }));
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white dark:bg-gray-900 rounded-xl shadow-2xl w-full max-w-xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">⚙️ 设置</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-xl leading-none">✕</button>
        </div>

        <div className="flex border-b border-gray-200 dark:border-gray-700">
          {(Object.keys(TAB_LABELS) as TabKey[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2 text-sm font-medium transition-colors ${
                tab === t
                  ? "text-blue-600 border-b-2 border-blue-600 dark:text-blue-400 dark:border-blue-400"
                  : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
              }`}
            >
              {TAB_LABELS[t]}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {loading ? (
            <p className="text-gray-400 text-center py-8">加载中...</p>
          ) : (
            <>
              {tab === "google" && <ProxyGoogleFields settings={settings} update={update} />}
              {tab === "affiliate" && <AffiliateFields settings={settings} update={update} />}
              {tab === "sync" && <SyncFields settings={settings} update={update} />}
            </>
          )}
        </div>

        <div className="flex items-center justify-between px-5 py-3 border-t border-gray-200 dark:border-gray-700">
          <span className={`text-sm ${message.includes("✅") ? "text-green-600" : "text-red-500"}`}>{message}</span>
          <div className="flex gap-2">
            <button onClick={onClose} className="px-4 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 dark:text-white transition-colors">关闭</button>
            <button onClick={handleSave} disabled={saving} className="px-4 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors">{saving ? "保存中..." : "保存设置"}</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Form field helpers
// ============================================================

function Field({ label, value, onChange, type = "text", placeholder = "", hint }: {
  label: string; value: string; onChange: (v: string) => void;
  type?: string; placeholder?: string; hint?: string;
}) {
  return (
    <div className="mb-3">
      {label ? <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">{label}</label> : null}
      <input
        type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
        className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
      {hint && <p className="text-xs text-gray-400 mt-0.5">{hint}</p>}
    </div>
  );
}

// ============================================================
// Google Ads tab: Proxy API (recommended) + OAuth2 (fallback)
// ============================================================

function ProxyGoogleFields({ settings, update }: {
  settings: AppSettings;
  update: (f: keyof AppSettings, v: string) => void;
}) {
  return (
    <div>
      {/* Proxy API — recommended */}
      <div className="mb-5 p-4 rounded-lg border-2 border-green-300 bg-green-50 dark:bg-green-950/30 dark:border-green-700">
        <div className="flex items-center gap-2 mb-3">
          <span className="bg-green-500 text-white text-xs font-bold px-2 py-0.5 rounded">推荐</span>
          <h3 className="text-sm font-semibold text-green-800 dark:text-green-300">代理 API（只需一个 Key）</h3>
        </div>
        <p className="text-xs text-green-700 dark:text-green-400 mb-3">
          使用 streamingconverter.com 代理 API。无需 OAuth2、无需 Google Cloud Console、无需 Developer Token。
        </p>
        <Field
          label="Proxy API Key"
          value={settings.googleAdsProxyApiKey}
          onChange={(v) => update("googleAdsProxyApiKey", v)}
          type="password"
          placeholder="粘贴你的 API Key"
        />
        {settings.googleAdsProxyApiKey && (
          <p className="text-sm text-green-600 dark:text-green-400 mt-2">✅ 保存后刷新页面，所有 MCC 和子账户自动出现在下拉菜单中。</p>
        )}
      </div>

      {/* OAuth2 — fallback */}
      <details className="border border-gray-200 dark:border-gray-700 rounded-lg">
        <summary className="px-4 py-3 cursor-pointer text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 select-none">
          备选方案：直接 OAuth2（需要 Google Cloud Console 项目）
        </summary>
        <div className="px-4 pb-4 space-y-3">
          <Field label="Developer Token" value={settings.googleAdsDeveloperToken} onChange={(v) => update("googleAdsDeveloperToken", v)} placeholder="Google Ads → API 中心 → Developer Token" />
          <Field label="Client ID" value={settings.googleAdsClientId} onChange={(v) => update("googleAdsClientId", v)} placeholder="xxxx.apps.googleusercontent.com" />
          <Field label="Client Secret" value={settings.googleAdsClientSecret} onChange={(v) => update("googleAdsClientSecret", v)} type="password" placeholder="GOCSPX-xxxx" />
          <Field label="Refresh Token" value={settings.googleAdsRefreshToken} onChange={(v) => update("googleAdsRefreshToken", v)} type="password" placeholder="自动获取或手动填入" />
          <button
            onClick={async () => {
              if (!settings.googleAdsClientId || !settings.googleAdsClientSecret || !settings.googleAdsDeveloperToken) {
                alert("请先填写 Developer Token、Client ID 和 Client Secret");
                return;
              }
              await fetch("/api/settings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(settings) });
              window.location.href = "/api/auth/google/login";
            }}
            disabled={!settings.googleAdsClientId || !settings.googleAdsClientSecret || !settings.googleAdsDeveloperToken}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg shadow-sm hover:shadow-md disabled:opacity-40 disabled:cursor-not-allowed text-sm font-medium text-gray-700 dark:bg-gray-800 dark:text-white dark:border-gray-600"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
            使用 Google 账号授权
          </button>
        </div>
      </details>
    </div>
  );
}

// ============================================================
// Affiliate tab
// ============================================================

function AffiliateFields({ settings, update }: {
  settings: AppSettings;
  update: (f: keyof AppSettings, v: string) => void;
}) {
  return (
    <div>
      <Select label="平台类型" value={settings.affiliatePlatform} onChange={(v) => update("affiliatePlatform", v)}
        options={[{ value: "mock", label: "Mock（演示数据）" }, { value: "generic", label: "通用 REST API" }, { value: "impact", label: "Impact / Partnerize" }, { value: "cj", label: "CJ Affiliate" }, { value: "shareasale", label: "ShareASale" }]}
      />
      {settings.affiliatePlatform === "generic" && (
        <>
          <Field label="API URL" value={settings.affiliateApiUrl} onChange={(v) => update("affiliateApiUrl", v)} placeholder="https://api.example.com/v1/reports" />
          <Field label="API Key" value={settings.affiliateApiKey} onChange={(v) => update("affiliateApiKey", v)} type="password" placeholder="your_api_key" />
          <Field label="自定义 Headers（JSON，可选）" value={settings.affiliateApiHeaders} onChange={(v) => update("affiliateApiHeaders", v)} placeholder='{"X-Api-Key": "{{API_KEY}}"}' hint='{{API_KEY}} 会自动替换为上方填写的 API Key' />
          <Field label="数据路径" value={settings.affiliateDataPath} onChange={(v) => update("affiliateDataPath", v)} placeholder="data.results" hint="API 返回 JSON 中数据数组的位置" />
          <Field label="字段映射（JSON，可选）" value={settings.affiliateFieldMapping} onChange={(v) => update("affiliateFieldMapping", v)} placeholder='{"date": "report_date", "clicks": "total_clicks"}' />
          <Field label="额外查询参数（JSON，可选）" value={settings.affiliateQueryParams} onChange={(v) => update("affiliateQueryParams", v)} placeholder='{"limit": "1000"}' />
        </>
      )}
      {settings.affiliatePlatform === "mock" && <p className="text-sm text-green-600 dark:text-green-400 mt-2">✅ Mock 模式已启用，使用演示数据。</p>}
    </div>
  );
}

// ============================================================
// Sync tab
// ============================================================

function SyncFields({ settings, update }: {
  settings: AppSettings;
  update: (f: keyof AppSettings, v: string) => void;
}) {
  return (
    <div>
      <Select label="自动同步间隔" value={settings.syncIntervalMinutes} onChange={(v) => update("syncIntervalMinutes", v)}
        options={[
          { value: "0", label: "关闭自动同步" }, { value: "30", label: "每30分钟" },
          { value: "60", label: "每小时" }, { value: "360", label: "每6小时" },
          { value: "720", label: "每12小时" }, { value: "1440", label: "每24小时（默认）" },
        ]}
        hint="修改后需要重启服务才能生效"
      />
    </div>
  );
}

function Select({ label, value, onChange, options, hint }: {
  label: string; value: string; onChange: (v: string) => void;
  options: { value: string; label: string }[]; hint?: string;
}) {
  return (
    <div className="mb-3">
      <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">{label}</label>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500">
        {options.map((o) => (<option key={o.value} value={o.value}>{o.label}</option>))}
      </select>
      {hint && <p className="text-xs text-gray-400 mt-0.5">{hint}</p>}
    </div>
  );
}
