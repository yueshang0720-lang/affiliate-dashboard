/**
 * POST /api/sync
 * Trigger a manual data sync. Optionally pass date range in body.
 *
 * Body (JSON):
 *   { startDate?: string, endDate?: string }
 *
 * Response:
 *   { success: boolean, message: string, syncLogId?: number }
 */

import { NextRequest, NextResponse } from "next/server";
import { runSync } from "@/lib/sync-service";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { startDate, endDate, accountId, mccId } = body as {
      startDate?: string;
      endDate?: string;
      accountId?: string;
      mccId?: string;
    };

    const result = await runSync(startDate, endDate, accountId, mccId);

    return NextResponse.json({
      success: true,
      message: result.message,
      syncLogId: result.syncLogId,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Sync failed";
    return NextResponse.json(
      { success: false, message },
      { status: 500 }
    );
  }
}
