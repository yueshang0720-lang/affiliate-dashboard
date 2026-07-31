/**
 * Sync Service
 *
 * Orchestrates the full data sync pipeline:
 *   1. Fetch from Google Ads API (skip if not configured)
 *   2. Fetch from Affiliate API (skip if not configured)
 *   3. Match / merge data
 *   4. Store in JSON file
 *   5. Log the sync result
 */

import { fetchGoogleAdsMetrics } from "./google-ads-client";
import { getAffiliateClient } from "./affiliate-client";
import { matchData } from "./matcher";
import { upsertStats, createSyncLog, updateSyncLog, getLastSync } from "./db";
import type { SyncLog, GoogleAdsMetrics, AffiliateMetrics } from "@/types";

export async function runSync(
  startDate?: string,
  endDate?: string,
  accountId?: string,
  mccId?: string
): Promise<{ syncLogId: number; message: string }> {
  // Default: sync yesterday if no dates specified
  if (!endDate) {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    endDate = yesterday.toISOString().split("T")[0];
  }
  if (!startDate) {
    // Default: last 30 days
    const thirtyDaysAgo = new Date(endDate);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    startDate = thirtyDaysAgo.toISOString().split("T")[0];
  }

  const logId = createSyncLog();
  let googleCount = 0;
  let affiliateCount = 0;
  let matchedCount = 0;
  const messages: string[] = [];

  try {
    // Step 1: Fetch Google Ads data (graceful skip if not configured)
    let googleAds: GoogleAdsMetrics[] = [];
    try {
      console.log(
        `[sync] Fetching Google Ads data: ${startDate} -> ${endDate}`
      );
      googleAds = await fetchGoogleAdsMetrics(startDate, endDate, accountId, mccId);
      googleCount = googleAds.length;
      console.log(`[sync] Google Ads: ${googleCount} rows`);
      messages.push(`${googleCount} Google Ads rows`);
    } catch (error) {
      const msg = (error as Error).message;
      console.warn(`[sync] Google Ads skipped: ${msg}`);
      messages.push("Google Ads skipped (not configured)");
    }

    // Step 2: Fetch Affiliate data (graceful skip if not configured)
    let affiliate: AffiliateMetrics[] = [];
    try {
      console.log(
        `[sync] Fetching affiliate data: ${startDate} -> ${endDate}`
      );
      const affiliateClient = getAffiliateClient();
      affiliate = await affiliateClient.fetchMetrics(startDate, endDate);
      affiliateCount = affiliate.length;
      console.log(`[sync] Affiliate: ${affiliateCount} rows`);
      messages.push(`${affiliateCount} affiliate rows`);
    } catch (error) {
      const msg = (error as Error).message;
      console.warn(`[sync] Affiliate skipped: ${msg}`);
      messages.push("Affiliate skipped (not configured)");
    }

    if (googleCount === 0 && affiliateCount === 0) {
      throw new Error(
        "No data from either source. Configure at least one API in .env.local"
      );
    }

    // Step 3: Match data
    const matched = matchData(googleAds, affiliate);
    matchedCount = matched.length;
    console.log(`[sync] Matched: ${matchedCount} rows`);
    messages.push(`${matchedCount} matched rows`);

    // Step 4: Store
    const upserted = upsertStats(matched);
    console.log(`[sync] Upserted: ${upserted} rows`);

    // Step 5: Mark sync as successful
    const resultMessage = messages.join(" + ");
    updateSyncLog(logId, {
      status: "success",
      recordsFetched: googleCount + affiliateCount,
      recordsMatched: matchedCount,
    });

    return {
      syncLogId: logId,
      message: `Synced: ${resultMessage}`,
    };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    console.error(`[sync] Failed: ${errorMessage}`);

    updateSyncLog(logId, {
      status: "failed",
      recordsFetched: googleCount + affiliateCount,
      recordsMatched: matchedCount,
      errorMessage,
    });

    throw new Error(`Sync failed: ${errorMessage}`);
  }
}

export async function getLastSyncInfo(): Promise<SyncLog | null> {
  return getLastSync();
}
