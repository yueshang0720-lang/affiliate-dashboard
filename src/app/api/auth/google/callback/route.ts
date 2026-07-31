/**
 * GET /api/auth/google/callback
 * Handles the OAuth2 callback from Google.
 * Exchanges the authorization code for access + refresh tokens,
 * then stores them and redirects back to the app.
 */

import { NextRequest, NextResponse } from "next/server";
import { loadSettings, saveSettings, resolveSetting } from "@/lib/settings";

/** Auto-detect base URL */
function getBaseUrl(): string {
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  }
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }
  if (process.env.NEXT_PUBLIC_BASE_URL) {
    return process.env.NEXT_PUBLIC_BASE_URL;
  }
  return "http://localhost:3000";
}

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const error = searchParams.get("error");

  const host = getBaseUrl();

  if (error || !code) {
    // Redirect back to the app with error
    return NextResponse.redirect(
      `${host}/?auth_error=${encodeURIComponent(error || "no_code")}`
    );
  }

  const settings = loadSettings();
  const clientId = resolveSetting(
    "GOOGLE_ADS_CLIENT_ID",
    settings.googleAdsClientId
  );
  const clientSecret = resolveSetting(
    "GOOGLE_ADS_CLIENT_SECRET",
    settings.googleAdsClientSecret
  );

  if (!clientId || !clientSecret) {
    return NextResponse.redirect(
      `${host}/?auth_error=missing_client_config`
    );
  }

  const redirectUri = `${host}/api/auth/google/callback`;

  try {
    // Exchange authorization code for tokens
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    });

    if (!tokenResponse.ok) {
      const errText = await tokenResponse.text();
      console.error("OAuth2 token exchange failed:", errText);
      return NextResponse.redirect(
        `${host}/?auth_error=${encodeURIComponent("token_exchange_failed")}`
      );
    }

    const tokens = (await tokenResponse.json()) as {
      access_token: string;
      refresh_token?: string;
      expires_in: number;
      scope: string;
    };

    if (!tokens.refresh_token) {
      return NextResponse.redirect(
        `${host}/?auth_error=no_refresh_token&hint=revoke_and_retry`
      );
    }

    // Store the refresh token in settings
    // (access_token is short-lived, refresh_token is permanent)
    saveSettings({
      googleAdsRefreshToken: tokens.refresh_token,
      googleAdsAuthStatus: "connected",
    });

    // Redirect back to the app with success
    return NextResponse.redirect(`${host}/?auth_success=1`);
  } catch (err) {
    console.error("OAuth2 callback error:", err);
    return NextResponse.redirect(
      `${host}/?auth_error=${encodeURIComponent((err as Error).message)}`
    );
  }
}
