/**
 * Data Matcher
 *
 * Matches Google Ads metrics with Affiliate metrics by (date, campaign_name).
 *
 * Supports campaign mapping: multiple Google Ads campaigns → one Affiliate campaign.
 * When mappings are configured, GA data is aggregated before matching.
 */

import type { GoogleAdsMetrics, AffiliateMetrics, UnifiedStats } from "@/types";
import { loadMappings } from "./campaign-mapping";

export function matchData(
  googleAds: GoogleAdsMetrics[],
  affiliate: AffiliateMetrics[]
): UnifiedStats[] {
  // Step 0: Apply campaign mappings — translate GA campaign names
  const gaMapped = applyGaMappings(googleAds);

  // Step 1: Aggregate Google Ads data by (date, mapped_campaign_name)
  const gaAggregated = aggregateGoogleAds(gaMapped);

  // Step 2: Build lookup maps
  const gaMap = new Map<string, GoogleAdsMetrics>();
  const affMap = new Map<string, AffiliateMetrics>();

  for (const row of gaAggregated) {
    gaMap.set(makeKey(row.date, row.campaignName), row);
  }
  for (const row of affiliate) {
    affMap.set(makeKey(row.date, row.campaignName), row);
  }

  // Step 3: Full outer join
  const allKeys = new Set([...gaMap.keys(), ...affMap.keys()]);
  const results: UnifiedStats[] = [];

  for (const key of allKeys) {
    const ga = gaMap.get(key);
    const aff = affMap.get(key);

    const date = ga?.date || aff?.date || "";
    const campaignName = ga?.campaignName || aff?.campaignName || "";
    const campaignId = ga?.campaignId || aff?.campaignId || "";

    const gaImpressions = ga?.impressions || 0;
    const gaClicks = ga?.clicks || 0;
    const gaCost = ga?.cost || 0;
    const gaConversions = ga?.conversions || 0;
    const gaCtr = gaImpressions > 0 ? gaClicks / gaImpressions : 0;
    const gaCpc = gaClicks > 0 ? gaCost / gaClicks : 0;

    const affClicks = aff?.clicks || 0;
    const affConversions = aff?.conversions || 0;
    const affCommission = aff?.commission || 0;
    const affOrderValue = aff?.orderValue || 0;
    const affConversionRate = affClicks > 0 ? (affConversions / affClicks) * 100 : 0;

    const profit = affCommission - gaCost;
    const roi = gaCost > 0 ? Math.round((profit / gaCost) * 10000) / 100 : 0;

    results.push({
      date,
      campaignName,
      campaignId,
      gaImpressions,
      gaClicks,
      gaCost: Math.round(gaCost * 100) / 100,
      gaConversions,
      gaCtr: Math.round(gaCtr * 10000) / 100,
      gaCpc: Math.round(gaCpc * 100) / 100,
      affClicks,
      affConversions,
      affCommission: Math.round(affCommission * 100) / 100,
      affOrderValue: Math.round(affOrderValue * 100) / 100,
      affConversionRate: Math.round(affConversionRate * 100) / 100,
      roi,
      profit: Math.round(profit * 100) / 100,
    });
  }

  results.sort((a, b) => {
    const d = b.date.localeCompare(a.date);
    return d !== 0 ? d : a.campaignName.localeCompare(b.campaignName);
  });

  return results;
}

// ============================================================
// Helpers
// ============================================================

function applyGaMappings(rows: GoogleAdsMetrics[]): GoogleAdsMetrics[] {
  const mappings = loadMappings();
  if (mappings.length === 0) return rows;

  // Build lookup: gaCampaignName → mapped affCampaignName
  const nameMap = new Map<string, string>();
  for (const m of mappings) {
    for (const gaName of m.gaCampaignNames) {
      nameMap.set(gaName, m.affCampaignName);
    }
  }

  return rows.map((row) => ({
    ...row,
    campaignName: nameMap.get(row.campaignName) || row.campaignName,
  }));
}

/**
 * Aggregate Google Ads rows that map to the same (date, campaignName).
 * Sums impressions, clicks, cost, conversions; recalculates CTR/CPC.
 */
function aggregateGoogleAds(
  rows: GoogleAdsMetrics[]
): GoogleAdsMetrics[] {
  const groups = new Map<string, GoogleAdsMetrics>();

  for (const row of rows) {
    const key = makeKey(row.date, row.campaignName);
    const existing = groups.get(key);

    if (!existing) {
      groups.set(key, { ...row });
    } else {
      existing.impressions += row.impressions;
      existing.clicks += row.clicks;
      existing.cost += row.cost;
      existing.conversions += row.conversions;
      existing.ctr = existing.impressions > 0 ? existing.clicks / existing.impressions : 0;
      existing.cpc = existing.clicks > 0 ? existing.cost / existing.clicks : 0;
      // Use latest campaignId
      existing.campaignId = existing.campaignId || row.campaignId;
    }
  }

  // Round aggregated values
  return Array.from(groups.values()).map((r) => ({
    ...r,
    cost: Math.round(r.cost * 100) / 100,
    ctr: Math.round(r.ctr * 10000) / 100,
    cpc: Math.round(r.cpc * 100) / 100,
  }));
}

function makeKey(date: string, campaignName: string): string {
  return `${date}|${normalize(campaignName)}`;
}

function normalize(name: string): string {
  return name.toLowerCase().trim().replace(/\s+/g, " ").replace(/[_-]/g, " ");
}
