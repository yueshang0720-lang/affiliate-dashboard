/**
 * GET /api/accounts
 * Fetch accessible Google Ads accounts (MCC hierarchy).
 */

import { NextResponse } from "next/server";
import { fetchAccessibleAccounts } from "@/lib/google-ads-client";
import { loadSettings, saveSettings } from "@/lib/settings";

export const runtime = "nodejs";

export async function GET() {
  try {
    const accounts = await fetchAccessibleAccounts();
    const settings = loadSettings();

    return NextResponse.json({
      accounts,
      selectedAccountId: settings.googleAdsSelectedAccountId || "",
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to fetch accounts";
    // If not configured, return empty list
    if (message.includes("Missing Google Ads config") || message.includes("not configured")) {
      return NextResponse.json({
        accounts: [],
        selectedAccountId: "",
        message: "Google Ads API not configured yet",
      });
    }
    return NextResponse.json({ error: message, accounts: [] }, { status: 500 });
  }
}

/**
 * POST /api/accounts
 * Update the selected account ID in settings.
 */
export async function POST(request: Request) {
  try {
    const { accountId } = (await request.json()) as { accountId: string };

    saveSettings({ googleAdsSelectedAccountId: accountId });

    return NextResponse.json({ success: true, accountId });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: (error as Error).message },
      { status: 500 }
    );
  }
}
