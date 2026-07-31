/**
 * GET /api/auth/google/login
 * Builds the Google OAuth2 consent URL and redirects the user.
 *
 * Uses the same OAuth2 flow as Google's official docs:
 *   https://accounts.google.com/o/oauth2/v2/auth
 *
 * Required settings:
 *   googleAdsClientId     - From Google Cloud Console > APIs & Services > Credentials
 *   googleAdsClientSecret - From same place (used in callback, not in this URL)
 *
 * The redirect_uri must be added to the Authorized redirect URIs
 * in Google Cloud Console for this client_id.
 */

import { NextResponse } from "next/server";
import { loadSettings, resolveSetting } from "@/lib/settings";
import crypto from "crypto";

export const runtime = "nodejs";

export async function GET() {
  const settings = loadSettings();

  const clientId = resolveSetting(
    "GOOGLE_ADS_CLIENT_ID",
    settings.googleAdsClientId
  );

  if (!clientId) {
    return NextResponse.json(
      {
        error:
          "请先在设置中填写 Google Cloud Client ID（你已有的那个）。",
      },
      { status: 400 }
    );
  }

  // Auto-detect the correct host:
  // Vercel: use VERCEL_URL or NEXT_PUBLIC_BASE_URL
  // Local: http://localhost:3000
  const host = getBaseUrl();
  const redirectUri = `${host}/api/auth/google/callback`;

  // Generate random state for CSRF protection
  const state = crypto.randomBytes(16).toString("hex");

  // Google Ads API scope
  const scope = "https://www.googleapis.com/auth/adwords";

  // Build the authorization URL
  // Format: https://accounts.google.com/o/oauth2/v2/auth?params...
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope,
    access_type: "offline",       // REQUIRED to get a refresh_token
    prompt: "consent",              // Force consent screen to ensure refresh_token
    include_granted_scopes: "true",
    state,
  });

  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;

  console.log("[oauth2] Redirecting to Google auth");

  return NextResponse.redirect(authUrl);
}

/** Auto-detect base URL: Vercel env vars → custom env → localhost fallback */
function getBaseUrl(): string {
  // Vercel production
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  }
  // Vercel preview
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }
  // Custom override
  if (process.env.NEXT_PUBLIC_BASE_URL) {
    return process.env.NEXT_PUBLIC_BASE_URL;
  }
  // Local dev
  return "http://localhost:3000";
}
