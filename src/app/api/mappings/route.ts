/**
 * GET  /api/mappings — Load mappings + available campaigns from both sides
 * POST /api/mappings — Add a mapping
 * PUT  /api/mappings?id=xxx — Update a mapping
 * DELETE /api/mappings?id=xxx — Delete a mapping
 */

import { NextRequest, NextResponse } from "next/server";
import {
  loadMappings,
  addMapping,
  updateMapping,
  deleteMapping,
} from "@/lib/campaign-mapping";
import { queryStats } from "@/lib/db";

export const runtime = "nodejs";

export async function GET() {
  try {
    const mappings = loadMappings();

    // Get distinct campaign names from synced data
    const allData = queryStats({ pageSize: 99999 });
    const gaCampaigns = [
      ...new Set(
        allData.rows
          .filter((r) => r.gaClicks > 0 || r.gaImpressions > 0)
          .map((r) => r.campaignName)
      ),
    ].sort();
    const affCampaigns = [
      ...new Set(
        allData.rows
          .filter((r) => r.affClicks > 0 || r.affConversions > 0)
          .map((r) => r.campaignName)
      ),
    ].sort();

    return NextResponse.json({ mappings, gaCampaigns, affCampaigns });
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { gaCampaignNames, affCampaignName } = body as {
      gaCampaignNames: string[];
      affCampaignName: string;
    };
    if (!gaCampaignNames?.length || !affCampaignName) {
      return NextResponse.json({ error: "gaCampaignNames and affCampaignName required" }, { status: 400 });
    }
    const mapping = addMapping({ gaCampaignNames, affCampaignName });
    return NextResponse.json({ success: true, mapping });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const id = request.nextUrl.searchParams.get("id");
    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
    const body = await request.json();
    const result = updateMapping(id, body);
    if (!result) return NextResponse.json({ error: "not found" }, { status: 404 });
    return NextResponse.json({ success: true, mapping: result });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const id = request.nextUrl.searchParams.get("id");
    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
    const ok = deleteMapping(id);
    return NextResponse.json({ success: ok });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
