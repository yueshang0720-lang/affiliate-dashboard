/**
 * Google Ads API Client
 *
 * Two modes:
 *   1. Proxy mode (recommended): Uses streamingconverter.com proxy API
 *      Only needs an API key. No OAuth2, no Google Cloud Console setup.
 *   2. Direct mode: Uses Google Ads REST API with OAuth2
 *
 * Mode is automatically selected: if googleAdsProxyApiKey is configured,
 * proxy mode is used. Otherwise falls back to direct OAuth2 mode.
 */

import { loadSettings, resolveSetting } from "./settings";
import type { GoogleAdsMetrics } from "@/types";

// ============================================================
// PROXY MODE (streamingconverter.com)
// ============================================================

const PROXY_BASE = "https://googleapi.streamingconverter.com/api/googleads";

export interface GoogleAdsAccount {
  id: string;
  name: string;
  isManager: boolean;
  parentMccId?: string;
  parentMccName?: string;
}

export interface GoogleAdsMccTree {
  mccId: string;
  mccName: string;
  clients: { customerId: string; customerName: string }[];
}

function getProxyApiKey(): string {
  const settings = loadSettings();
  return resolveSetting("GOOGLE_ADS_PROXY_API_KEY", settings.googleAdsProxyApiKey);
}

function isProxyMode(): boolean {
  return !!getProxyApiKey();
}

async function proxyPost<T>(
  path: string,
  body: Record<string, string> = {}
): Promise<T> {
  const apiKey = getProxyApiKey();
  if (!apiKey) throw new Error("Proxy API key not configured");

  const res = await fetch(`${PROXY_BASE}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-Key": apiKey,
    },
    body: JSON.stringify(body),
  });

  const json = await res.json() as {
    issucc: boolean;
    errinfo: string;
    data: T;
    summary?: Record<string, unknown>;
  };

  if (!json.issucc) {
    throw new Error(json.errinfo || "Proxy API error");
  }

  return json.data;
}

/**
 * Fetch accessible accounts via proxy API.
 * Returns all MCCs with their sub-accounts.
 */
export async function fetchAccessibleAccounts(): Promise<GoogleAdsAccount[]> {
  if (!isProxyMode()) {
    return fetchAccessibleAccountsDirect();
  }

  const trees = await proxyPost<GoogleAdsMccTree[]>("/accounts", {});

  const accounts: GoogleAdsAccount[] = [];

  for (const mcc of trees) {
    // Add MCC as manager account
    accounts.push({
      id: mcc.mccId,
      name: mcc.mccName,
      isManager: true,
    });

    // Add sub-accounts
    for (const client of mcc.clients) {
      accounts.push({
        id: client.customerId,
        name: client.customerName,
        isManager: false,
        parentMccId: mcc.mccId,
        parentMccName: mcc.mccName,
      });
    }
  }

  return accounts;
}

interface ProxyCampaign {
  campaign_id: string;
  campaign_name: string;
  status: string;
  daily_budget: string;
}

interface ProxyCampaignStat {
  campaign_id: string;
  campaign_name: string;
  status: string;
  date: string;
  impressions: number;
  clicks: number;
  cost: string;
  ctr: string;
  avg_cpc: string;
}

/**
 * Fetch campaign metrics via proxy API.
 */
export async function fetchGoogleAdsMetrics(
  startDate: string,
  endDate: string,
  accountId?: string
): Promise<GoogleAdsMetrics[]> {
  if (!isProxyMode()) {
    return fetchGoogleAdsMetricsDirect(startDate, endDate, accountId);
  }

  if (!accountId) {
    throw new Error("Proxy mode requires a selected account. Please select an account from the dropdown.");
  }

  // Fetch campaigns
  const campaigns = await proxyPost<ProxyCampaign[]>("/campaigns", {
    customer_id: accountId,
  });

  // Fetch stats for all campaigns
  const stats = await proxyPost<ProxyCampaignStat[]>("/campaigns/stats", {
    customer_id: accountId,
    start_date: startDate,
    end_date: endDate,
  });

  // Build campaign lookup
  const campaignMap = new Map<string, ProxyCampaign>();
  for (const c of campaigns) {
    campaignMap.set(c.campaign_id, c);
  }

  return stats.map((s) => {
    const cpm = campaignMap.get(s.campaign_id);
    return {
      date: s.date,
      campaignId: s.campaign_id,
      campaignName: s.campaign_name,
      impressions: s.impressions,
      clicks: s.clicks,
      cost: parseFloat(s.cost) || 0,
      conversions: 0, // Not provided by this API
      ctr: parseFloat(s.ctr) || 0,
      cpc: parseFloat(s.avg_cpc) || 0,
    };
  });
}

// ============================================================
// DIRECT MODE (Google Ads REST API + OAuth2)
// ============================================================

export interface GoogleAdsConfig {
  clientId: string;
  clientSecret: string;
  developerToken: string;
  refreshToken: string;
  customerId: string;
  loginCustomerId?: string;
}

export function getGoogleAdsConfig(accountId?: string): GoogleAdsConfig {
  const settings = loadSettings();

  const config: GoogleAdsConfig = {
    clientId: resolveSetting("GOOGLE_ADS_CLIENT_ID", settings.googleAdsClientId),
    clientSecret: resolveSetting("GOOGLE_ADS_CLIENT_SECRET", settings.googleAdsClientSecret),
    developerToken: resolveSetting("GOOGLE_ADS_DEVELOPER_TOKEN", settings.googleAdsDeveloperToken),
    refreshToken: resolveSetting("GOOGLE_ADS_REFRESH_TOKEN", settings.googleAdsRefreshToken),
    customerId: accountId || resolveSetting("GOOGLE_ADS_CUSTOMER_ID", settings.googleAdsCustomerId),
    loginCustomerId: resolveSetting("GOOGLE_ADS_LOGIN_CUSTOMER_ID", settings.googleAdsLoginCustomerId) || undefined,
  };

  const missing = Object.entries(config)
    .filter(([k, v]) => k !== "loginCustomerId" && !v)
    .map(([k]) => k);

  if (missing.length > 0) {
    throw new Error(`Missing Google Ads config: ${missing.join(", ")}`);
  }

  return config;
}

async function fetchAccessibleAccountsDirect(): Promise<GoogleAdsAccount[]> {
  const config = getGoogleAdsConfig();
  const parentId = config.loginCustomerId || config.customerId;
  if (!parentId) return [];

  const accessToken = await getAccessToken(config);
  const query = `
    SELECT customer_client.id, customer_client.descriptive_name, customer_client.manager, customer_client.level
    FROM customer_client WHERE customer_client.status = 'ENABLED'
    ORDER BY customer_client.manager DESC, customer_client.level
  `.trim();

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${accessToken}`,
    "developer-token": config.developerToken,
  };
  if (config.loginCustomerId) headers["login-customer-id"] = config.loginCustomerId;

  const url = `https://googleads.googleapis.com/v18/customers/${parentId}/googleAds:search`;
  const allResults: Record<string, unknown>[] = [];
  let pageToken: string | null = null;

  do {
    const body: Record<string, unknown> = { query, pageSize: 10000 };
    if (pageToken) body.pageToken = pageToken;
    const response = await fetch(url, { method: "POST", headers, body: JSON.stringify(body) });
    if (!response.ok) {
      if (response.status === 400 || response.status === 403) {
        return [{ id: config.customerId, name: `Account ${config.customerId}`, isManager: false }];
      }
      throw new Error(`Google Ads API error (${response.status})`);
    }
    const data = (await response.json()) as Record<string, unknown>;
    const results = data.results as Record<string, unknown>[];
    if (results) allResults.push(...results);
    pageToken = data.nextPageToken as string | null;
  } while (pageToken);

  return allResults.map((row) => {
    const cc = row.customer_client as Record<string, unknown>;
    return {
      id: String(cc.id),
      name: cc.descriptive_name as string,
      isManager: cc.manager as boolean,
    };
  }).filter((a) => a.id);
}

async function fetchGoogleAdsMetricsDirect(
  startDate: string,
  endDate: string,
  accountId?: string
): Promise<GoogleAdsMetrics[]> {
  const config = getGoogleAdsConfig(accountId);

  const query = `
    SELECT campaign.id, campaign.name, segments.date,
      metrics.impressions, metrics.clicks, metrics.cost_micros,
      metrics.conversions, metrics.ctr, metrics.average_cpc
    FROM campaign
    WHERE segments.date BETWEEN '${startDate}' AND '${endDate}'
    ORDER BY segments.date, campaign.name
  `.trim();

  const accessToken = await getAccessToken(config);
  const url = `https://googleads.googleapis.com/v18/customers/${config.customerId}/googleAds:search`;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${accessToken}`,
    "developer-token": config.developerToken,
  };
  if (config.loginCustomerId) headers["login-customer-id"] = config.loginCustomerId;

  const allResults: Record<string, unknown>[] = [];
  let pageToken: string | null = null;

  do {
    const body: Record<string, unknown> = { query, pageSize: 10000 };
    if (pageToken) body.pageToken = pageToken;
    const response = await fetch(url, { method: "POST", headers, body: JSON.stringify(body) });
    if (!response.ok) throw new Error(`Google Ads API error (${response.status})`);
    const data = (await response.json()) as Record<string, unknown>;
    const results = data.results as Record<string, unknown>[];
    if (results) allResults.push(...results);
    pageToken = data.nextPageToken as string | null;
  } while (pageToken);

  return allResults.map((row) => {
    const campaign = row.campaign as Record<string, unknown>;
    const segments = row.segments as Record<string, unknown>;
    const metrics = row.metrics as Record<string, unknown>;
    const costMicros = Number(metrics.cost_micros) || 0;

    return {
      date: segments.date as string,
      campaignId: String(campaign.id),
      campaignName: campaign.name as string,
      impressions: Number(metrics.impressions) || 0,
      clicks: Number(metrics.clicks) || 0,
      cost: Math.round((costMicros / 1_000_000) * 100) / 100,
      conversions: Number(metrics.conversions) || 0,
      ctr: Number(metrics.ctr) || 0,
      cpc: Number(metrics.average_cpc) || 0,
    };
  });
}

async function getAccessToken(config: GoogleAdsConfig): Promise<string> {
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      refresh_token: config.refreshToken,
      grant_type: "refresh_token",
    }),
  });
  if (!response.ok) throw new Error(`OAuth2 error (${response.status})`);
  const data = (await response.json()) as { access_token: string };
  return data.access_token;
}
