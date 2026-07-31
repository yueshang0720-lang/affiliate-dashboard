/**
 * Data Matcher
 *
 * Matches Google Ads metrics with Affiliate metrics by (date, campaign_name).
 * Produces unified rows with match status tagging.
 */

import type { GoogleAdsMetrics, AffiliateMetrics, UnifiedStats } from "@/types";

export function matchData(
  googleAds: GoogleAdsMetrics[],
  affiliate: AffiliateMetrics[]
): UnifiedStats[] {
  // Build lookup maps keyed by "date|campaign_name_normalized"
  const gaMap = new Map<string, GoogleAdsMetrics>();
  const affMap = new Map<string, AffiliateMetrics>();

  for (const row of googleAds) {
    const key = makeKey(row.date, row.campaignName);
    gaMap.set(key, row);
  }

  for (const row of affiliate) {
    const key = makeKey(row.date, row.campaignName);
    affMap.set(key, row);
  }

  // Collect all unique keys from both sources
  const allKeys = new Set([...gaMap.keys(), ...affMap.keys()]);

  const results: UnifiedStats[] = [];

  for (const key of allKeys) {
    const ga = gaMap.get(key);
    const aff = affMap.get(key);

    const date = ga?.date || aff?.date || "";
    const campaignName = ga?.campaignName || aff?.campaignName || "";
    const campaignId = ga?.campaignId || aff?.campaignId || "";

    // Google Ads side
    const gaImpressions = ga?.impressions || 0;
    const gaClicks = ga?.clicks || 0;
    const gaCost = ga?.cost || 0;
    const gaConversions = ga?.conversions || 0;
    const gaCtr = ga?.ctr || (gaImpressions > 0 ? gaClicks / gaImpressions : 0);
    const gaCpc = ga?.cpc || (gaClicks > 0 ? gaCost / gaClicks : 0);

    // Affiliate side
    const affClicks = aff?.clicks || 0;
    const affConversions = aff?.conversions || 0;
    const affCommission = aff?.commission || 0;
    const affOrderValue = aff?.orderValue || 0;
    const affConversionRate =
      aff?.conversionRate ||
      (affClicks > 0 ? (affConversions / affClicks) * 100 : 0);

    // Derived
    const profit = affCommission - gaCost;
    const roi =
      gaCost > 0
        ? Math.round(((affCommission - gaCost) / gaCost) * 10000) / 100
        : 0;

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

  // Sort by date desc, then campaign name
  results.sort((a, b) => {
    const dateCmp = b.date.localeCompare(a.date);
    if (dateCmp !== 0) return dateCmp;
    return a.campaignName.localeCompare(b.campaignName);
  });

  return results;
}

// ============================================================
// Helpers
// ============================================================

function makeKey(date: string, campaignName: string): string {
  return `${date}|${normalizeCampaignName(campaignName)}`;
}

function normalizeCampaignName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ") // collapse multiple spaces
    .replace(/[_-]/g, " "); // treat underscores and dashes as spaces
}

// ============================================================
// Fuzzy matching utils (for advanced use)
// ============================================================

export function findPotentialMatches(
  googleAds: GoogleAdsMetrics[],
  affiliate: AffiliateMetrics[]
): { gaName: string; affName: string; similarity: number }[] {
  const suggestions: {
    gaName: string;
    affName: string;
    similarity: number;
  }[] = [];
  const matchedAff = new Set<string>();

  for (const ga of googleAds) {
    const gaNorm = normalizeCampaignName(ga.campaignName);

    for (const aff of affiliate) {
      if (matchedAff.has(aff.campaignName)) continue;

      const affNorm = normalizeCampaignName(aff.campaignName);
      const similarity = diceSimilarity(gaNorm, affNorm);

      if (
        similarity > 0.7 &&
        similarity < 1.0 && // exclude exact matches
        ga.date === aff.date
      ) {
        suggestions.push({
          gaName: ga.campaignName,
          affName: aff.campaignName,
          similarity: Math.round(similarity * 100) / 100,
        });
      }
    }
  }

  // Deduplicate by affiliate name
  const seen = new Set<string>();
  return suggestions.filter((s) => {
    const key = `${s.affName}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// Sørensen–Dice coefficient for string similarity
function diceSimilarity(a: string, b: string): number {
  if (a === b) return 1.0;
  if (a.length < 2 || b.length < 2) return 0;

  const bigramsA = getBigrams(a);
  const bigramsB = getBigrams(b);

  let intersection = 0;
  const mapA = new Map<string, number>();
  for (const bg of bigramsA) {
    mapA.set(bg, (mapA.get(bg) || 0) + 1);
  }
  for (const bg of bigramsB) {
    const count = mapA.get(bg);
    if (count && count > 0) {
      intersection++;
      mapA.set(bg, count - 1);
    }
  }

  return (2 * intersection) / (bigramsA.length + bigramsB.length);
}

function getBigrams(str: string): string[] {
  const bigrams: string[] = [];
  for (let i = 0; i < str.length - 1; i++) {
    bigrams.push(str.substring(i, i + 2));
  }
  return bigrams;
}
