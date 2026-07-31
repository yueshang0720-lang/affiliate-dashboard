/**
 * Settings storage
 *
 * Local dev:  JSON file on disk (data/settings.json)
 * Vercel/Prod: In-memory store + env vars. Critical credentials (OAuth2)
 *              must be set as Vercel Environment Variables.
 */

import path from "path";
import fs from "fs";

export interface AppSettings {
  googleAdsClientId: string;
  googleAdsClientSecret: string;
  googleAdsDeveloperToken: string;
  googleAdsRefreshToken: string;
  googleAdsCustomerId: string;
  googleAdsLoginCustomerId: string;
  affiliatePlatform: string;
  affiliateApiUrl: string;
  affiliateApiKey: string;
  affiliateApiHeaders: string;
  affiliateDataPath: string;
  affiliateFieldMapping: string;
  affiliateQueryParams: string;
  googleAdsAuthStatus: string;
  googleAdsSelectedAccountId: string;
  syncIntervalMinutes: string;
}

const DEFAULT_SETTINGS: AppSettings = {
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

const isVercel = process.env.VERCEL === "1";

// In-memory settings store (for Vercel or as fallback)
let memorySettings: AppSettings = { ...DEFAULT_SETTINGS };

function settingsPath(): string {
  const dir = path.resolve(process.cwd(), "data");
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return path.join(dir, "settings.json");
}

export function loadSettings(): AppSettings {
  // On Vercel, primary source is env vars + memory
  if (isVercel) {
    return { ...DEFAULT_SETTINGS, ...memorySettings };
  }

  // Local: read from file
  try {
    const fp = settingsPath();
    if (fs.existsSync(fp)) {
      const stored = JSON.parse(fs.readFileSync(fp, "utf-8")) as Partial<AppSettings>;
      return { ...DEFAULT_SETTINGS, ...stored };
    }
  } catch { /* fall through */ }
  return { ...DEFAULT_SETTINGS };
}

export function saveSettings(updates: Partial<AppSettings>): AppSettings {
  const current = loadSettings();
  const merged = { ...current, ...updates };

  if (isVercel) {
    memorySettings = merged;
    return merged;
  }

  // Local: save to file
  try {
    fs.writeFileSync(settingsPath(), JSON.stringify(merged, null, 2), "utf-8");
  } catch { /* best effort */ }
  return merged;
}

/**
 * Resolve a setting: env var takes priority over stored value.
 */
export function resolveSetting(
  envKey: string,
  storedValue: string
): string {
  const envValue = process.env[envKey];
  if (envValue !== undefined && envValue !== "") {
    return envValue;
  }
  return storedValue || "";
}
