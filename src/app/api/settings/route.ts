/**
 * GET  /api/settings - Load current settings (masked sensitive values)
 * POST /api/settings - Save settings
 */

import { NextRequest, NextResponse } from "next/server";
import { loadSettings, saveSettings } from "@/lib/settings";
import type { AppSettings } from "@/lib/settings";

export const runtime = "nodejs";

export async function GET() {
  const settings = loadSettings();
  // Return with sensitive fields partially masked for security
  return NextResponse.json({
    ...settings,
    googleAdsClientSecret: mask(settings.googleAdsClientSecret),
    googleAdsRefreshToken: mask(settings.googleAdsRefreshToken),
    affiliateApiKey: mask(settings.affiliateApiKey),
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as Partial<AppSettings>;

    // If masked values are sent back (user didn't change them),
    // keep the existing stored values
    const current = loadSettings();

    if (body.googleAdsClientSecret && isMasked(body.googleAdsClientSecret)) {
      body.googleAdsClientSecret = current.googleAdsClientSecret;
    }
    if (body.googleAdsRefreshToken && isMasked(body.googleAdsRefreshToken)) {
      body.googleAdsRefreshToken = current.googleAdsRefreshToken;
    }
    if (body.affiliateApiKey && isMasked(body.affiliateApiKey)) {
      body.affiliateApiKey = current.affiliateApiKey;
    }

    const updated = saveSettings(body);
    return NextResponse.json({
      success: true,
      settings: {
        ...updated,
        googleAdsClientSecret: mask(updated.googleAdsClientSecret),
        googleAdsRefreshToken: mask(updated.googleAdsRefreshToken),
        affiliateApiKey: mask(updated.affiliateApiKey),
      },
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: (error as Error).message },
      { status: 500 }
    );
  }
}

function mask(val: string): string {
  if (!val || val.length <= 8) return val;
  return val.slice(0, 4) + "****" + val.slice(-4);
}

function isMasked(val: string): boolean {
  return val.includes("****");
}
