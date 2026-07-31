/**
 * GET /api/stats
 * Return summary statistics and last sync info for KPI cards.
 *
 * Query params:
 *   startDate - YYYY-MM-DD (optional)
 *   endDate   - YYYY-MM-DD (optional)
 *
 * Response:
 *   { summary: SummaryStats, lastSync: SyncLog | null }
 */

import { NextRequest, NextResponse } from "next/server";
import { getSummaryStats, getLastSync } from "@/lib/db";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get("startDate") || undefined;
    const endDate = searchParams.get("endDate") || undefined;

    const summary = getSummaryStats({ startDate, endDate });
    const lastSync = getLastSync();

    return NextResponse.json({ summary, lastSync });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to fetch stats";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
