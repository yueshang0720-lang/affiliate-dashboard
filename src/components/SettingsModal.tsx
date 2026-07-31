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

  // Load settings when opened
  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setMessage("");
    fetch("/api/settings")
      .then((r) => r.json())
      .then((data) => {
        // Strip any non-settings fields
        const { success, ...rest } = data;
        setSettings({ ...INITIAL, ...rest });
      })
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
      if (data.success) {
        setMessage("✅ 设置已保存！");
      } else {
        setMessage(`❌ 保存失败: ${data.message}`);
      }
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
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">
            ⚙️ 设置
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-xl leading-none"
          >
            ✕
          </button>
        </div>

        {/* Tabs */}
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

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5">
          {loading ? (
            <p className="text-gray-400 text-center py-8">加载中...</p>
          ) : (
            <>
              {tab === "google" && (
                <GoogleAdsFields settings={settings} update={update} />
              )}
              {tab === "affiliate" && (
                <AffiliateFields settings={settings} update={update} />
              )}
              {tab === "sync" && (
                <SyncFields settings={settings} update={update} />
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-gray-200 dark:border-gray-700">
          <span
            className={`text-sm ${message.includes("✅") ? "text-green-600" : "text-red-500"}`}
          >
            {message}
          </span>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 dark:text-white transition-colors"
            >
              关闭
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {saving ? "保存中..." : "保存设置"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Field sub-components
// ============================================================

function Field({
  label,
  value,
  onChange,
  type = "text",
  placeholder = "",
  hint,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
  hint?: string;
}) {
  return (
    <div className="mb-3">
      <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
        {label}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
      {hint && (
        <p className="text-xs text-gray-400 mt-0.5">{hint}</p>
      )}
    </div>
  );
}

function Select({
  label,
  value,
  onChange,
  options,
  hint,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  hint?: string;
}) {
  return (
    <div className="mb-3">
      <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
        {label}
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {hint && (
        <p className="text-xs text-gray-400 mt-0.5">{hint}</p>
      )}
    </div>
  );
}

// ============================================================
// Tab content
// ============================================================

function GoogleAdsFields({
  settings,
  update,
}: {
  settings: AppSettings;
  update: (f: keyof AppSettings, v: string) => void;
}) {
  const [authStatus, setAuthStatus] = useState<{
    connected: boolean;
    hasClientId: boolean;
    hasClientSecret: boolean;
    hasRefreshToken: boolean;
    hasDevToken: boolean;
  } | null>(null);
  const [checking, setChecking] = useState(false);
  const [connectError, setConnectError] = useState("");

  // Check auth status
  useEffect(() => {
    setChecking(true);
    fetch("/api/auth/google/status")
      .then((r) => r.json())
      .then(setAuthStatus)
      .catch(() => {})
      .finally(() => setChecking(false));
  }, []);

  // Re-check when tab becomes visible (user returns from Google OAuth)
  useEffect(() => {
    const handler = () => {
      if (document.visibilityState === "visible") {
        fetch("/api/auth/google/status")
          .then((r) => r.json())
          .then(setAuthStatus);
      }
    };
    document.addEventListener("visibilitychange", handler);
    return () => document.removeEventListener("visibilitychange", handler);
  }, []);

  const isConnected = authStatus?.connected;

  const handleConnect = async () => {
    setConnectError("");
    if (!settings.googleAdsClientId || !settings.googleAdsClientSecret) {
      setConnectError("请先展开下方「高级配置」，填写 Client ID 和 Client Secret（从 Google Cloud Console 获取，只需一次）");
      return;
    }
    if (!settings.googleAdsDeveloperToken) {
      setConnectError("请先填写 Developer Token");
      return;
    }
    try {
      await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      window.location.href = "/api/auth/google/login";
    } catch {
      setConnectError("保存失败，请重试");
    }
  };

  const callbackUri =
    typeof window !== "undefined"
      ? `${window.location.origin}/api/auth/google/callback`
      : "http://localhost:3000/api/auth/google/callback";

  return (
    <div>
      {/* ── 主按钮：Google 授权 ── */}
      <div className="text-center py-6">
        {checking ? (
          <p className="text-gray-400">检查授权状态...</p>
        ) : isConnected ? (
          <div className="py-4">
            <div className="text-3xl mb-2">✅</div>
            <p className="text-green-700 dark:text-green-400 font-semibold text-base">
              Google Ads 已授权
            </p>
            <p className="text-sm text-gray-500 mt-1">
              你的所有 MCC 和子账户已自动出现在主页下拉菜单中
            </p>
            <button
              onClick={handleConnect}
              className="mt-3 text-xs text-blue-500 hover:underline"
            >
              重新授权
            </button>
          </div>
        ) : (
          <div>
            <button
              onClick={handleConnect}
              className="inline-flex items-center gap-3 px-8 py-4 bg-white border-2 border-gray-300 rounded-xl shadow-lg hover:shadow-xl active:scale-[0.97] transition-all text-base font-semibold text-gray-800 dark:bg-gray-800 dark:text-white dark:border-gray-600"
            >
              <svg className="w-6 h-6" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              使用 Google 账号授权
            </button>
            <p className="text-xs text-gray-400 mt-3 max-w-md mx-auto">
              点击后跳转 Google 授权页面 → 选择你的谷歌账号 → 允许访问 Google Ads
              → 自动回到本页面。首次使用需配置下方凭证（仅一次）。
            </p>
            {connectError && (
              <p className="text-sm text-red-500 mt-3">{connectError}</p>
            )}
          </div>
        )}
      </div>

      {/* ── 折叠：一次性凭证配置 ── */}
      <details className="border border-gray-200 dark:border-gray-700 rounded-lg">
        <summary className="px-4 py-3 cursor-pointer text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 select-none">
          高级配置：OAuth2 凭证（只需配置一次）
        </summary>
        <div className="px-4 pb-4 space-y-4">
          {/* Developer Token */}
          <div className="p-3 rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800">
            <h4 className="text-sm font-semibold text-amber-800 dark:text-amber-300 mb-2">
              Developer Token
            </h4>
            <p className="text-xs text-amber-600 dark:text-amber-400 mb-2">
              Google Ads 后台 → 管理 → API 中心 → 复制 Developer Token
            </p>
            <Field
              label=""
              value={settings.googleAdsDeveloperToken}
              onChange={(v) => update("googleAdsDeveloperToken", v)}
              placeholder="粘贴 Developer Token"
            />
          </div>

          {/* Client ID + Secret */}
          <div className="p-3 rounded-lg border border-blue-200 bg-blue-50 dark:bg-blue-950/30 dark:border-blue-800">
            <h4 className="text-sm font-semibold text-blue-800 dark:text-blue-300 mb-2">
              OAuth2 Client ID & Secret
            </h4>
            <div className="text-xs text-blue-600 dark:text-blue-400 mb-3 space-y-1">
              <p>1. 打开{" "}
                <a href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noopener" className="underline font-medium">
                  Google Cloud Console → 凭据
                </a>
              </p>
              <p>2. 创建 OAuth 2.0 客户端 ID → Web 应用</p>
              <p>3. 添加授权重定向 URI：</p>
              <code className="block bg-blue-100 dark:bg-blue-900 px-2 py-1 rounded mt-1 text-xs">
                {callbackUri}
              </code>
              <p>4. 复制 Client ID 和 Client Secret 到下方</p>
            </div>
            <Field
              label="Client ID"
              value={settings.googleAdsClientId}
              onChange={(v) => update("googleAdsClientId", v)}
              placeholder="xxxx.apps.googleusercontent.com"
            />
            <Field
              label="Client Secret"
              value={settings.googleAdsClientSecret}
              onChange={(v) => update("googleAdsClientSecret", v)}
              type="password"
              placeholder="GOCSPX-xxxx"
            />
          </div>
        </div>
      </details>
    </div>
  );
}

function AffiliateFields({
  settings,
  update,
}: {
  settings: AppSettings;
  update: (f: keyof AppSettings, v: string) => void;
}) {
  return (
    <div>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
        选择联盟平台并填写 API 信息。选择 &quot;Mock&quot; 可生成演示数据。
      </p>

      <Select
        label="平台类型"
        value={settings.affiliatePlatform}
        onChange={(v) => update("affiliatePlatform", v)}
        options={[
          { value: "mock", label: "Mock（演示数据）" },
          { value: "generic", label: "通用 REST API" },
          { value: "impact", label: "Impact / Partnerize" },
          { value: "cj", label: "CJ Affiliate" },
          { value: "shareasale", label: "ShareASale" },
        ]}
      />

      {settings.affiliatePlatform === "generic" && (
        <>
          <Field
            label="API URL"
            value={settings.affiliateApiUrl}
            onChange={(v) => update("affiliateApiUrl", v)}
            placeholder="https://api.example.com/v1/reports"
          />
          <Field
            label="API Key"
            value={settings.affiliateApiKey}
            onChange={(v) => update("affiliateApiKey", v)}
            type="password"
            placeholder="your_api_key"
            hint=""
          />
          <Field
            label="自定义 Headers（JSON格式，可选）"
            value={settings.affiliateApiHeaders}
            onChange={(v) => update("affiliateApiHeaders", v)}
            placeholder='{"X-Api-Key": "{{API_KEY}}"}'
            hint='{{API_KEY}} 会自动替换为上方填写的 API Key'
          />
          <Field
            label="数据路径"
            value={settings.affiliateDataPath}
            onChange={(v) => update("affiliateDataPath", v)}
            placeholder="data.results"
            hint="API返回JSON中数据数组的位置，用.分隔，如 data.results"
          />
          <Field
            label="字段映射（JSON格式，可选）"
            value={settings.affiliateFieldMapping}
            onChange={(v) => update("affiliateFieldMapping", v)}
            placeholder='{"date": "report_date", "clicks": "total_clicks"}'
            hint="将你的API字段名映射到系统字段：date, campaignId, campaignName, clicks, conversions, commission, orderValue"
          />
          <Field
            label="额外查询参数（JSON格式，可选）"
            value={settings.affiliateQueryParams}
            onChange={(v) => update("affiliateQueryParams", v)}
            placeholder='{"limit": "1000", "status": "active"}'
          />
        </>
      )}

      {settings.affiliatePlatform === "mock" && (
        <p className="text-sm text-green-600 dark:text-green-400 mt-2">
          ✅ Mock 模式已启用。系统将生成随机的演示数据用于测试。
        </p>
      )}

      {(settings.affiliatePlatform === "impact" ||
        settings.affiliatePlatform === "cj" ||
        settings.affiliatePlatform === "shareasale") && (
        <p className="text-sm text-amber-600 dark:text-amber-400 mt-2">
          ⚠️ {settings.affiliatePlatform} 适配器尚未实现。建议先用 &quot;通用 REST API&quot; 或联系开发者。
        </p>
      )}
    </div>
  );
}

function SyncFields({
  settings,
  update,
}: {
  settings: AppSettings;
  update: (f: keyof AppSettings, v: string) => void;
}) {
  return (
    <div>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
        设置自动同步的时间间隔。
      </p>

      <Select
        label="自动同步间隔"
        value={settings.syncIntervalMinutes}
        onChange={(v) => update("syncIntervalMinutes", v)}
        options={[
          { value: "0", label: "关闭自动同步" },
          { value: "30", label: "每30分钟" },
          { value: "60", label: "每小时" },
          { value: "360", label: "每6小时" },
          { value: "720", label: "每12小时" },
          { value: "1440", label: "每24小时（默认）" },
        ]}
        hint="修改后需要重启服务才能生效"
      />
    </div>
  );
}
