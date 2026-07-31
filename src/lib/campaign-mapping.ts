/**
 * Campaign Mapping Storage
 * N:1 mapping: multiple Google Ads campaigns → one Affiliate campaign/offer
 */

import path from "path";
import fs from "fs";

export interface CampaignMapping {
  id: string;
  gaCampaignNames: string[]; // multiple Google Ads campaigns
  affCampaignName: string;   // one affiliate offer/campaign
}

const isVercel = process.env.VERCEL === "1";
let memoryMappings: CampaignMapping[] = [];

function filePath(): string {
  const dir = path.resolve(process.cwd(), "data");
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return path.join(dir, "campaign_mappings.json");
}

export function loadMappings(): CampaignMapping[] {
  if (isVercel) return memoryMappings;
  try {
    const fp = filePath();
    if (fs.existsSync(fp)) {
      memoryMappings = JSON.parse(fs.readFileSync(fp, "utf-8"));
    }
  } catch { /* use memory */ }
  return memoryMappings;
}

export function saveMappings(mappings: CampaignMapping[]): void {
  memoryMappings = mappings;
  if (isVercel) return;
  try {
    fs.writeFileSync(filePath(), JSON.stringify(mappings, null, 2), "utf-8");
  } catch { /* best effort */ }
}

export function addMapping(mapping: Omit<CampaignMapping, "id">): CampaignMapping {
  const mappings = loadMappings();
  const newMapping: CampaignMapping = {
    ...mapping,
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
  };
  mappings.push(newMapping);
  saveMappings(mappings);
  return newMapping;
}

export function updateMapping(id: string, updates: Partial<CampaignMapping>): CampaignMapping | null {
  const mappings = loadMappings();
  const idx = mappings.findIndex((m) => m.id === id);
  if (idx === -1) return null;
  mappings[idx] = { ...mappings[idx], ...updates };
  saveMappings(mappings);
  return mappings[idx];
}

export function deleteMapping(id: string): boolean {
  const mappings = loadMappings();
  const filtered = mappings.filter((m) => m.id !== id);
  if (filtered.length === mappings.length) return false;
  saveMappings(filtered);
  return true;
}

/**
 * Apply mappings to Google Ads campaign names.
 * Returns a map: original_ga_campaign_name → mapped_aff_campaign_name
 */
export function applyMappings(
  gaCampaignNames: string[]
): Map<string, string> {
  const mappings = loadMappings();
  const result = new Map<string, string>();

  for (const gaName of gaCampaignNames) {
    // Check if this GA campaign matches any mapping rule
    for (const mapping of mappings) {
      if (mapping.gaCampaignNames.includes(gaName)) {
        result.set(gaName, mapping.affCampaignName);
        break;
      }
    }
    // If no mapping found, keep original name (will try direct match)
    if (!result.has(gaName)) {
      result.set(gaName, gaName);
    }
  }

  return result;
}
