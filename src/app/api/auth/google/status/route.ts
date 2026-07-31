/**
 * GET /api/auth/google/status
 * Returns current Google Ads OAuth2 connection status.
 */

import { NextResponse } from "next/server";
import { loadSettings, resolveSetting } from "@/lib/settings";

export const runtime = "nodejs";

export async function GET() {
  const settings = loadSettings();

  const hasClientId = !!(
    resolveSetting("GOOGLE_ADS_CLIENT_ID", settings.googleAdsClientId)
  );
  const hasClientSecret = !!(
    resolveSetting("GOOGLE_ADS_CLIENT_SECRET", settings.googleAdsClientSecret)
  );
  const hasRefreshToken = !!(
    resolveSetting("GOOGLE_ADS_REFRESH_TOKEN", settings.googleAdsRefreshToken)
  );
  const hasDevToken = !!(
    resolveSetting("GOOGLE_ADS_DEVELOPER_TOKEN", settings.googleAdsDeveloperToken)
  );

  const connected = hasClientId && hasClientSecret && hasRefreshToken && hasDevToken;

  return NextResponse.json({
    connected,
    hasClientId,
    hasClientSecret,
    hasRefreshToken,
    hasDevToken,
    authStatus: settings.googleAdsAuthStatus || "not_configured",
  });
}
