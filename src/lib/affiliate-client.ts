/**
 * Affiliate API Adapter
 *
 * Reads credentials from: .env.local (preferred) or stored settings.json
 *
 * Supported platforms:
 *   "mock"    - Fake data for development/demo
 *   "generic" - Configurable REST API adapter
 *   "impact"  - Impact/Partnerize (stub)
 *   "cj"      - CJ Affiliate (stub)
 *   "shareasale" - ShareASale (stub)
 */

import type { AffiliateMetrics } from "@/types";
import { loadSettings, resolveSetting } from "./settings";

export interface AffiliateClient {
  readonly platform: string;
  fetchMetrics(
    startDate: string,
    endDate: string
  ): Promise<AffiliateMetrics[]>;
  testConnection(): Promise<{ ok: boolean; message: string }>;
}

// ============================================================
// Factory
// ============================================================

export function getAffiliateClient(): AffiliateClient {
  const settings = loadSettings();
  const platform = resolveSetting("AFFILIATE_PLATFORM", settings.affiliatePlatform) || "mock";

  switch (platform.toLowerCase()) {
    case "impact":
      return new ImpactAdapter();
    case "cj":
    case "commissionjunction":
      return new CJAdapter();
    case "shareasale":
      return new ShareASaleAdapter();
    case "mock":
      return new MockAdapter();
    case "generic":
    default:
      return new GenericRestAdapter();
  }
}

// ============================================================
// Generic REST adapter - reads from stored settings
// ============================================================

export class GenericRestAdapter implements AffiliateClient {
  readonly platform = "generic";

  private get baseUrl(): string {
    const settings = loadSettings();
    return resolveSetting("AFFILIATE_API_URL", settings.affiliateApiUrl);
  }

  private get apiKey(): string {
    const settings = loadSettings();
    return resolveSetting("AFFILIATE_API_KEY", settings.affiliateApiKey);
  }

  private get headers(): Record<string, string> {
    const settings = loadSettings();
    const headerStr = resolveSetting("AFFILIATE_API_HEADERS", settings.affiliateApiHeaders);
    const headers: Record<string, string> = {};

    if (headerStr) {
      try {
        const parsed = JSON.parse(headerStr);
        for (const [k, v] of Object.entries(parsed)) {
          headers[k] = (v as string).replace("{{API_KEY}}", this.apiKey);
        }
      } catch {
        headers["X-Api-Key"] = this.apiKey;
      }
    } else if (this.apiKey) {
      headers["X-Api-Key"] = this.apiKey;
    }
    return headers;
  }

  async fetchMetrics(
    startDate: string,
    endDate: string
  ): Promise<AffiliateMetrics[]> {
    if (!this.baseUrl) {
      throw new Error(
        "Affiliate API URL not configured. Set it in Settings or AFFILIATE_API_URL in .env.local"
      );
    }

    const url = new URL(this.baseUrl);
    url.searchParams.set("start_date", startDate);
    url.searchParams.set("end_date", endDate);

    const settings = loadSettings();
    const extraParams = resolveSetting("AFFILIATE_API_QUERY_PARAMS", settings.affiliateQueryParams);
    if (extraParams) {
      try {
        const parsed = JSON.parse(extraParams) as Record<string, string>;
        for (const [k, v] of Object.entries(parsed)) {
          url.searchParams.set(k, v);
        }
      } catch { /* ignore */ }
    }

    const response = await fetch(url.toString(), {
      method: "GET",
      headers: { Accept: "application/json", ...this.headers },
    });

    if (!response.ok) {
      throw new Error(
        `Affiliate API error (${response.status}): ${await response.text()}`
      );
    }

    const data = await response.json();
    const settings2 = loadSettings();
    const dataPath = resolveSetting("AFFILIATE_DATA_PATH", settings2.affiliateDataPath) || "data";
    const items = getNestedValue(data, dataPath);

    if (!Array.isArray(items)) {
      throw new Error(
        `Affiliate API: expected array at "${dataPath}", got ${typeof items}`
      );
    }

    const fieldMap = getFieldMapping();
    return items.map((item: Record<string, unknown>) =>
      mapToAffiliateMetrics(item, fieldMap)
    );
  }

  async testConnection(): Promise<{ ok: boolean; message: string }> {
    try {
      if (!this.baseUrl) {
        return { ok: false, message: "AFFILIATE_API_URL not configured" };
      }
      const response = await fetch(this.baseUrl, {
        method: "HEAD",
        headers: this.headers,
      });
      return {
        ok: response.ok,
        message: response.ok ? "Connection successful" : `HTTP ${response.status}`,
      };
    } catch (error) {
      return {
        ok: false,
        message: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }
}

// ============================================================
// Stub adapters (for future implementation)
// ============================================================

export class ImpactAdapter implements AffiliateClient {
  readonly platform = "impact";
  async fetchMetrics(): Promise<AffiliateMetrics[]> {
    throw new Error("Impact adapter not yet implemented. Use generic adapter or switch to mock.");
  }
  async testConnection(): Promise<{ ok: boolean; message: string }> {
    return { ok: false, message: "Impact adapter not yet implemented" };
  }
}

export class CJAdapter implements AffiliateClient {
  readonly platform = "cj";
  async fetchMetrics(): Promise<AffiliateMetrics[]> {
    throw new Error("CJ adapter not yet implemented. Use generic adapter or switch to mock.");
  }
  async testConnection(): Promise<{ ok: boolean; message: string }> {
    return { ok: false, message: "CJ adapter not yet implemented" };
  }
}

export class ShareASaleAdapter implements AffiliateClient {
  readonly platform = "shareasale";
  async fetchMetrics(): Promise<AffiliateMetrics[]> {
    throw new Error("ShareASale adapter not yet implemented. Use generic adapter or switch to mock.");
  }
  async testConnection(): Promise<{ ok: boolean; message: string }> {
    return { ok: false, message: "ShareASale adapter not yet implemented" };
  }
}

// ============================================================
// Mock adapter
// ============================================================

export class MockAdapter implements AffiliateClient {
  readonly platform = "mock";

  async fetchMetrics(
    startDate: string,
    endDate: string
  ): Promise<AffiliateMetrics[]> {
    const results: AffiliateMetrics[] = [];
    const campaigns = [
      "Summer Sale",
      "New Arrivals",
      "Best Sellers",
      "Clearance",
    ];

    const start = new Date(startDate);
    const end = new Date(endDate);

    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const dateStr = d.toISOString().split("T")[0];
      for (const campaign of campaigns) {
        const clicks = Math.floor(Math.random() * 200) + 10;
        const conversions = Math.floor(Math.random() * 20);
        const orderValue = conversions * (Math.random() * 100 + 30);
        results.push({
          date: dateStr,
          campaignId: `mock-${campaign.toLowerCase().replace(/\s+/g, "-")}`,
          campaignName: campaign,
          clicks,
          conversions,
          commission: Math.round(orderValue * 0.1 * 100) / 100,
          orderValue: Math.round(orderValue * 100) / 100,
          conversionRate:
            clicks > 0 ? Math.round((conversions / clicks) * 10000) / 100 : 0,
        });
      }
    }
    return results;
  }

  async testConnection(): Promise<{ ok: boolean; message: string }> {
    return { ok: true, message: "Mock adapter is always available" };
  }
}

// ============================================================
// Helpers
// ============================================================

interface FieldMapping {
  date: string;
  campaignId: string;
  campaignName: string;
  clicks: string;
  conversions: string;
  commission: string;
  orderValue: string;
  conversionRate: string;
}

function getFieldMapping(): FieldMapping {
  const settings = loadSettings();
  const defaults: FieldMapping = {
    date: "date",
    campaignId: "campaign_id",
    campaignName: "campaign_name",
    clicks: "clicks",
    conversions: "conversions",
    commission: "commission",
    orderValue: "order_value",
    conversionRate: "conversion_rate",
  };

  const mappingStr = resolveSetting("AFFILIATE_FIELD_MAPPING", settings.affiliateFieldMapping);
  if (mappingStr) {
    try {
      const custom = JSON.parse(mappingStr) as Partial<FieldMapping>;
      return { ...defaults, ...custom };
    } catch { /* ignore */ }
  }
  return defaults;
}

function getNestedValue(
  obj: Record<string, unknown>,
  path: string
): unknown {
  const parts = path.split(".");
  let current: unknown = obj;
  for (const part of parts) {
    if (current && typeof current === "object") {
      current = (current as Record<string, unknown>)[part];
    } else {
      return undefined;
    }
  }
  return current;
}

function mapToAffiliateMetrics(
  item: Record<string, unknown>,
  fm: FieldMapping
): AffiliateMetrics {
  const clicks = Number(getNestedValue(item, fm.clicks)) || 0;
  const conversions = Number(getNestedValue(item, fm.conversions)) || 0;

  return {
    date: String(getNestedValue(item, fm.date) || ""),
    campaignId: String(getNestedValue(item, fm.campaignId) || ""),
    campaignName: String(getNestedValue(item, fm.campaignName) || ""),
    clicks,
    conversions,
    commission: Number(getNestedValue(item, fm.commission)) || 0,
    orderValue: Number(getNestedValue(item, fm.orderValue)) || 0,
    conversionRate:
      clicks > 0
        ? Math.round((conversions / clicks) * 10000) / 100
        : 0,
  };
}
