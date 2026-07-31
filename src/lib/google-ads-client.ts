/**
 * Google Ads API Client
 *
 * Reads credentials from: .env.local (preferred) or stored settings.json
 * Uses REST API + OAuth2 — no special SDK needed.
 */

import { loadSettings, resolveSetting, saveSettings } from "./settings";
import type { GoogleAdsMetrics } from "@/types";

export interface GoogleAdsConfig {
  clientId: string;
  clientSecret: string;
  developerToken: string;
  refreshToken: string;
  customerId: string;        // currently selected account
  loginCustomerId?: string;  // MCC manager account
}

export function getGoogleAdsConfig(accountId?: string): GoogleAdsConfig {
  const settings = loadSettings();

  const config: GoogleAdsConfig = {
    clientId: resolveSetting("GOOGLE_ADS_CLIENT_ID", settings.googleAdsClientId),
    clientSecret: resolveSetting(
      "GOOGLE_ADS_CLIENT_SECRET",
      settings.googleAdsClientSecret
    ),
    developerToken: resolveSetting(
      "GOOGLE_ADS_DEVELOPER_TOKEN",
      settings.googleAdsDeveloperToken
    ),
    refreshToken: resolveSetting(
      "GOOGLE_ADS_REFRESH_TOKEN",
      settings.googleAdsRefreshToken
    ),
    customerId: accountId || resolveSetting(
      "GOOGLE_ADS_CUSTOMER_ID",
      settings.googleAdsCustomerId
    ),
    loginCustomerId:
      resolveSetting(
        "GOOGLE_ADS_LOGIN_CUSTOMER_ID",
        settings.googleAdsLoginCustomerId
      ) || undefined,
  };

  const missing = Object.entries(config)
    .filter(([k, v]) => k !== "loginCustomerId" && !v)
    .map(([k]) => k);

  if (missing.length > 0) {
    throw new Error(
      `Missing Google Ads config: ${missing.join(", ")}. Configure in Settings or .env.local`
    );
  }

  return config;
}

export async function fetchGoogleAdsMetrics(
  startDate: string,
  endDate: string,
  accountId?: string
): Promise<GoogleAdsMetrics[]> {
  const config = getGoogleAdsConfig(accountId);

  const query = `
    SELECT
      campaign.id,
      campaign.name,
      segments.date,
      metrics.impressions,
      metrics.clicks,
      metrics.cost_micros,
      metrics.conversions,
      metrics.ctr,
      metrics.average_cpc
    FROM campaign
    WHERE segments.date BETWEEN '${startDate}' AND '${endDate}'
    ORDER BY segments.date, campaign.name
  `.trim();

  const rows = await queryGoogleAdsApi(config, query);

  return rows.map((row: Record<string, unknown>) => {
    const campaign = row.campaign as Record<string, unknown>;
    const segments = row.segments as Record<string, unknown>;
    const metrics = row.metrics as Record<string, unknown>;

    const costMicros = Number(metrics.cost_micros) || 0;
    const cost = costMicros / 1_000_000;

    return {
      date: segments.date as string,
      campaignId: String(campaign.id),
      campaignName: campaign.name as string,
      impressions: Number(metrics.impressions) || 0,
      clicks: Number(metrics.clicks) || 0,
      cost: Math.round(cost * 100) / 100,
      conversions: Number(metrics.conversions) || 0,
      ctr: Number(metrics.ctr) || 0,
      cpc: Number(metrics.average_cpc) || 0,
    };
  });
}

// ============================================================
// Account hierarchy
// ============================================================

export interface GoogleAdsAccount {
  id: string;
  name: string;
  isManager: boolean;
  level: number; // 0 = root, 1 = sub-account, etc.
}

/**
 * Fetch list of accessible accounts.
 *
 * If a manager account (MCC) is configured via loginCustomerId,
 * queries its child accounts. Otherwise returns just the configured account.
 */
export async function fetchAccessibleAccounts(): Promise<GoogleAdsAccount[]> {
  const config = getGoogleAdsConfig();

  // Determine which account to use for listing children
  const parentId = config.loginCustomerId || config.customerId;

  if (!parentId) {
    throw new Error("No Google Ads customer ID configured");
  }

  const accessToken = await getAccessToken(config);

  // Query for child accounts under the manager
  const query = `
    SELECT
      customer_client.id,
      customer_client.descriptive_name,
      customer_client.manager,
      customer_client.level,
      customer_client.status
    FROM customer_client
    WHERE customer_client.status = 'ENABLED'
    ORDER BY customer_client.manager DESC, customer_client.level, customer_client.descriptive_name
  `.trim();

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${accessToken}`,
    "developer-token": config.developerToken,
  };
  if (config.loginCustomerId) {
    headers["login-customer-id"] = config.loginCustomerId;
  }

  const url = `https://googleads.googleapis.com/v18/customers/${parentId}/googleAds:search`;

  const allResults: Record<string, unknown>[] = [];
  let pageToken: string | null = null;

  do {
    const body: Record<string, unknown> = { query, pageSize: 10000 };
    if (pageToken) body.pageToken = pageToken;

    const response = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Google Ads accounts fetch error: ${errorText}`);
      // If no MCC access, return just the configured account
      if (response.status === 400 || response.status === 403) {
        return [
          {
            id: config.customerId,
            name: `Account ${config.customerId}`,
            isManager: false,
            level: 0,
          },
        ];
      }
      throw new Error(`Google Ads API error (${response.status}): ${errorText}`);
    }

    const data = (await response.json()) as Record<string, unknown>;
    const results = data.results as Record<string, unknown>[];
    if (results) allResults.push(...results);
    pageToken = data.nextPageToken as string | null;
  } while (pageToken);

  const accounts: GoogleAdsAccount[] = allResults
    .map((row) => {
      const cc = row.customer_client as Record<string, unknown>;
      return {
        id: String(cc.id),
        name: cc.descriptive_name as string,
        isManager: cc.manager as boolean,
        level: (cc.level as number) || 0,
      };
    })
    // Filter out MCC manager accounts (keep only leaf accounts that have campaigns)
    // But we'll keep them all and let the user see the full hierarchy
    .filter((a) => a.id);

  // Auto-select first non-manager account if none selected yet
  const settings = loadSettings();
  if (!settings.googleAdsSelectedAccountId) {
    const firstLeaf = accounts.find((a) => !a.isManager);
    if (firstLeaf) {
      saveSettings({ googleAdsSelectedAccountId: firstLeaf.id });
    }
  }

  // Also keep the selected account in settings
  return accounts;
}

// ============================================================
// Low-level API call
// ============================================================

async function queryGoogleAdsApi(
  config: GoogleAdsConfig,
  query: string
): Promise<Record<string, unknown>[]> {
  const accessToken = await getAccessToken(config);

  const url = `https://googleads.googleapis.com/v18/customers/${config.customerId}/googleAds:search`;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${accessToken}`,
    "developer-token": config.developerToken,
  };

  if (config.loginCustomerId) {
    headers["login-customer-id"] = config.loginCustomerId;
  }

  const allResults: Record<string, unknown>[] = [];
  let pageToken: string | null = null;

  do {
    const body: Record<string, unknown> = { query, pageSize: 10000 };
    if (pageToken) body.pageToken = pageToken;

    const response = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw new Error(
        `Google Ads API error (${response.status}): ${await response.text()}`
      );
    }

    const data = (await response.json()) as Record<string, unknown>;
    const results = data.results as Record<string, unknown>[];
    if (results) allResults.push(...results);

    pageToken = data.nextPageToken as string | null;
  } while (pageToken);

  return allResults;
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

  if (!response.ok) {
    throw new Error(
      `Google OAuth2 error (${response.status}): ${await response.text()}`
    );
  }

  const data = (await response.json()) as { access_token: string };
  return data.access_token;
}
