/**
 * NSW Planning Portal major projects — public HTML.
 * Verified Oct 2026: warehouse/distribution and data-storage filters return project pages
 * with status, development type, LGA and (sometimes) a street in the title.
 * https://www.planningportal.nsw.gov.au/major-projects/projects
 */

import { findWesternSydneySuburb } from "@/lib/geo";
import { fetchText, mapPool } from "@/lib/ingestion/http";

export type MajorProjectItem = {
  externalId: string;
  sourceUrl: string;
  publisher: string;
  title: string;
  excerpt: string;
  eventDate: Date | null;
  addressRaw: string;
  suburb: string | null;
  councilRef: string | null;
  signalHint: string;
  raw: Record<string, unknown>;
};

const PUBLISHER = "NSW Department of Planning, Housing and Infrastructure (Planning Portal)";

const LGAS: Array<{ code: string; name: string; pages: number; types: string[] }> = [
  {
    code: "10",
    name: "Blacktown",
    pages: 2,
    types: ["Warehouse or distribution centres", "Data Storage"],
  },
  {
    code: "93",
    name: "Penrith",
    pages: 2,
    types: ["Warehouse or distribution centres", "Data Storage"],
  },
  { code: "71", name: "Liverpool", pages: 1, types: ["Warehouse or distribution centres", "Data Storage"] },
  { code: "43", name: "Fairfield", pages: 1, types: ["Warehouse or distribution centres"] },
  { code: "38", name: "Cumberland", pages: 1, types: ["Warehouse or distribution centres"] },
  { code: "28", name: "Parramatta", pages: 1, types: ["Warehouse or distribution centres"] },
  { code: "20", name: "Camden", pages: 1, types: ["Warehouse or distribution centres"] },
  { code: "109", name: "The Hills", pages: 1, types: ["Warehouse or distribution centres"] },
];

const STREET =
  /\b(\d{1,5}[A-Za-z]?(?:\s*[-–]\s*\d{1,5}[A-Za-z]?)?\s+[A-Za-z][\w'\-]*(?:\s+[A-Za-z][\w'\-]*){0,3}\s(?:Road|Rd|Street|St|Avenue|Ave|Drive|Dr|Circuit|Cct|Parade|Pde|Place|Pl|Way|Boulevard|Blvd|Lane|Ln|Close|Cl|Crescent|Cres))\b/i;

function htmlToLines(html: string): string[] {
  const stripped = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, "\n");
  return stripped
    .split("\n")
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

function fieldValue(lines: string[], label: string): string | null {
  const wanted = label.toLowerCase();
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i].replace(/:$/, "").trim();
    if (line.toLowerCase() === wanted && lines[i + 1]) return lines[i + 1];
    if (lines[i].toLowerCase().startsWith(`${wanted}:`)) {
      const rest = lines[i].slice(label.length + 1).trim();
      if (rest) return rest;
    }
  }
  return null;
}

function cleanRef(value: string | null): string | null {
  if (!value) return null;
  const trimmed = value.replace(/\s+/g, " ").trim();
  if (trimmed.length < 3 || trimmed.length > 40) return null;
  if (!/[A-Za-z0-9]/.test(trimmed)) return null;
  if (/comment|withheld|applicant|name|status/i.test(trimmed)) return null;
  return trimmed;
}

function parseDate(text: string | null): Date | null {
  if (!text) return null;
  const match = text.match(/\b(\d{1,2}\s+[A-Za-z]+\s+\d{4})\b/);
  if (!match) return null;
  const date = new Date(match[1]);
  return Number.isNaN(date.getTime()) ? null : date;
}

function listSlugs(html: string): string[] {
  const slugs = [...html.matchAll(/href="\/major-projects\/projects\/([a-z0-9-]+)"/g)].map(
    (m) => m[1]
  );
  return [...new Set(slugs)];
}

function parseDetail(
  html: string,
  slug: string,
  expectedLga: string,
  developmentTypeQuery: string
): MajorProjectItem | null {
  const lines = htmlToLines(html);
  const h1 = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  const title = (h1?.[1] || slug).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  if (!title) return null;

  const status = fieldValue(lines, "Current Status") || fieldValue(lines, "Current Status:");
  const assessment = fieldValue(lines, "Assessment Type");
  const developmentType = fieldValue(lines, "Development Type") || developmentTypeQuery;
  const lga =
    fieldValue(lines, "Local Government Areas") ||
    fieldValue(lines, "Local Government Area") ||
    expectedLga;
  const applicationNumber = cleanRef(
    fieldValue(lines, "Application Number") || fieldValue(lines, "Application No")
  );

  const street = title.match(STREET)?.[1]?.replace(/\s+/g, " ").trim() || null;
  const suburb = findWesternSydneySuburb(`${title} ${lga}`) || expectedLga;
  const addressRaw = street
    ? street.replace(/\s+/g, " ").trim()
    : title;

  const datedLine = lines.find((line) =>
    /\b(lodged|exhibition|exhibited|determined|submitted)\b/i.test(line)
  );
  const eventDate = parseDate(datedLine || null) || parseDate(status);

  const streetNote = street
    ? `Street published in the project title: ${street}.`
    : "No street address was published on the project page. Location is the local government area named by the Planning Portal — not a guessed street.";

  const excerpt = [
    developmentType ? `Development type: ${developmentType}.` : null,
    assessment ? `Assessment: ${assessment}.` : null,
    status ? `Status published on the portal: ${status}.` : null,
    lga ? `Local government area: ${lga}.` : null,
    applicationNumber ? `Application number: ${applicationNumber}.` : null,
    streetNote,
    "A state-significant or major-project record is planning activity. It is not evidence that an owner wants to sell or lease.",
  ]
    .filter(Boolean)
    .join(" ");

  return {
    externalId: slug,
    sourceUrl: `https://www.planningportal.nsw.gov.au/major-projects/projects/${slug}`,
    publisher: PUBLISHER,
    title: `Major project — ${title}`,
    excerpt,
    eventDate,
    addressRaw,
    suburb,
    councilRef: applicationNumber ? applicationNumber.slice(0, 64) : null,
    signalHint: "planning_activity",
    raw: {
      slug,
      title,
      status,
      assessment,
      developmentType,
      lga,
      applicationNumber,
      street,
      expectedLga,
    },
  };
}

export async function fetchMajorProjects(options?: {
  maxDetails?: number;
}): Promise<{ items: MajorProjectItem[]; log: string[] }> {
  const maxDetails = options?.maxDetails ?? 36;
  const log: string[] = [];
  const slugs: Array<{ slug: string; lga: string; developmentType: string }> = [];

  const jobs: Array<{ url: string; lga: string; developmentType: string; page: number }> = [];
  for (const lga of LGAS) {
    for (const developmentType of lga.types) {
      for (let page = 0; page < lga.pages; page += 1) {
        const params = new URLSearchParams({
          development_type: developmentType,
          lga: lga.code,
        });
        if (page > 0) params.set("page", String(page));
        jobs.push({
          url: `https://www.planningportal.nsw.gov.au/major-projects/projects?${params.toString()}`,
          lga: lga.name,
          developmentType,
          page,
        });
      }
    }
  }

  await mapPool(jobs, 3, async (job) => {
    try {
      const html = await fetchText(job.url);
      const found = listSlugs(html);
      log.push(`${job.lga} / ${job.developmentType} page ${job.page}: ${found.length} projects`);
      for (const slug of found) {
        slugs.push({ slug, lga: job.lga, developmentType: job.developmentType });
      }
    } catch (err) {
      log.push(
        `${job.lga} page ${job.page} error: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  });

  const unique = Array.from(new Map(slugs.map((s) => [s.slug, s])).values()).slice(0, maxDetails);
  log.push(`Major-project detail candidates: ${unique.length} (cap ${maxDetails})`);

  const parsed = await mapPool(unique, 3, async (entry) => {
    try {
      const html = await fetchText(
        `https://www.planningportal.nsw.gov.au/major-projects/projects/${entry.slug}`
      );
      return parseDetail(html, entry.slug, entry.lga, entry.developmentType);
    } catch (err) {
      log.push(`detail ${entry.slug} error: ${err instanceof Error ? err.message : String(err)}`);
      return null;
    }
  });

  const items = parsed.filter((item): item is MajorProjectItem => item !== null);
  log.push(`Stored-eligible major projects: ${items.length}`);
  return { items, log };
}
