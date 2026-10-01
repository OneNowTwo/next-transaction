import * as cheerio from "cheerio";
import {
  INDUSTRIAL_KEYWORDS,
  NON_INDUSTRIAL,
  findWesternSydneySuburb,
  parseAustralianAddress,
} from "@/lib/geo";
import { fetchText, mapPool } from "@/lib/ingestion/http";

export type PlanningAlertItem = {
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

/** Planning Alerts authority slugs verified to return HTML (Oct 2026). */
export const PLANNING_AUTHORITIES = [
  "blacktown",
  "penrith",
  "liverpool",
  "fairfield",
  "campbelltown",
  "cumberland",
  "parramatta",
  "camden",
  "hawkesbury",
  "the_hills",
  "bankstown",
] as const;

function parseListPage(html: string): Array<{ id: string; snippet: string }> {
  const $ = cheerio.load(html);
  const items: Array<{ id: string; snippet: string }> = [];
  $('a[href^="/applications/"]').each((_, el) => {
    const href = $(el).attr("href") || "";
    const m = href.match(/^\/applications\/(\d+)/);
    if (!m) return;
    const snippet = $(el).text().replace(/\s+/g, " ").trim();
    if (!snippet) return;
    items.push({ id: m[1], snippet });
  });
  // de-dupe preserving order
  const seen = new Set<string>();
  return items.filter((i) => {
    if (seen.has(i.id)) return false;
    seen.add(i.id);
    return true;
  });
}

function parseDetail(html: string, id: string, snippet: string): PlanningAlertItem | null {
  const $ = cheerio.load(html);
  const addressRaw = $("h1").first().text().replace(/\s+/g, " ").trim();
  if (!addressRaw) return null;

  const field = (label: string): string | null => {
    let value: string | null = null;
    $("dt").each((_, el) => {
      if ($(el).text().trim().toLowerCase() === label.toLowerCase()) {
        const raw = $(el).next("dd").text().replace(/\s+/g, " ").trim();
        // Planning Alerts appends help text after the reference value.
        const cleaned = raw
          .replace(/\s+Info\b.*/i, "")
          .replace(/\s+View source\b.*/i, "")
          .trim();
        value = cleaned || raw || null;
      }
    });
    return value;
  };

  const description = field("Description") || "";
  const authority = field("Planning Authority") || "Planning Alerts";
  const referenceRaw: string | null = field("Reference number");
  const reference: string | null =
    referenceRaw && referenceRaw.length > 64
      ? referenceRaw.slice(0, 64)
      : referenceRaw;
  let eventDate: Date | null = null;
  const dateBlock = $("div")
    .filter((_, el) => $(el).text().trim() === "Date sourced")
    .next("div")
    .text()
    .replace(/\s+/g, " ")
    .trim();
  // e.g. "We found this application on the planning authority's website on 25 May 2025"
  const dm = dateBlock.match(/on\s+(\d{1,2}\s+\w+\s+\d{4})/i);
  if (dm) {
    const d = new Date(dm[1]);
    if (!Number.isNaN(d.getTime())) eventDate = d;
  }

  const parsed = parseAustralianAddress(addressRaw);
  const suburb = parsed.suburb || findWesternSydneySuburb(addressRaw);
  const blob = `${addressRaw} ${description} ${snippet}`;
  // Authority pages are already Western Sydney LGAs. Keep industrial wording only.
  if (!INDUSTRIAL_KEYWORDS.test(blob)) return null;
  // A house with a hardstand driveway is not an industrial lead.
  const clearlyIndustrial =
    /\b(warehouses?|industrial|factories|factory|logistics|distribution\s*cent|data\s*cent|cold\s*stor|manufactur)\b/i.test(
      blob
    );
  if (NON_INDUSTRIAL.test(blob) && !clearlyIndustrial) return null;

  const excerpt = [
    description || "No description provided on Planning Alerts.",
    reference ? `Council reference: ${reference}.` : null,
    authority ? `Authority: ${authority}.` : null,
    "Planning activity alone does not prove a sale or leasing instruction.",
  ]
    .filter(Boolean)
    .join(" ");

  return {
    externalId: id,
    sourceUrl: `https://www.planningalerts.org.au/applications/${id}`,
    publisher: authority,
    title: `Planning application — ${addressRaw}`,
    excerpt,
    eventDate,
    addressRaw,
    suburb,
    councilRef: reference,
    signalHint: "planning_activity",
    raw: {
      addressRaw,
      description,
      authority,
      reference,
      dateSourcedText: dateBlock || null,
    },
  };
}

export async function fetchPlanningAlerts(options?: {
  maxPagesPerAuthority?: number;
  maxDetails?: number;
}): Promise<{ items: PlanningAlertItem[]; log: string[] }> {
  const maxPages = options?.maxPagesPerAuthority ?? 3;
  const maxDetails = options?.maxDetails ?? 48;
  const log: string[] = [];
  const candidates: Array<{ id: string; snippet: string; authority: string }> = [];

  const pages: Array<{ authority: string; page: number; url: string }> = [];
  for (const authority of PLANNING_AUTHORITIES) {
    for (let page = 1; page <= maxPages; page += 1) {
      const url =
        page === 1
          ? `https://www.planningalerts.org.au/authorities/${authority}/applications`
          : `https://www.planningalerts.org.au/authorities/${authority}/applications?page=${page}`;
      pages.push({ authority, page, url });
    }
  }

  await mapPool(pages, 3, async ({ authority, page, url }) => {
    try {
      const html = await fetchText(url);
      const list = parseListPage(html);
      log.push(`${authority} page ${page}: ${list.length} listings`);
      for (const item of list) {
        if (INDUSTRIAL_KEYWORDS.test(item.snippet)) {
          candidates.push({ ...item, authority });
        }
      }
    } catch (err) {
      log.push(
        `${authority} page ${page} error: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  });

  const unique = Array.from(new Map(candidates.map((c) => [c.id, c])).values()).slice(
    0,
    maxDetails
  );
  log.push(`Detail fetch candidates: ${unique.length} (cap ${maxDetails})`);

  const parsedItems = await mapPool(unique, 2, async (c) => {
    try {
      await new Promise((r) => setTimeout(r, 180));
      const html = await fetchText(`https://www.planningalerts.org.au/applications/${c.id}`);
      return parseDetail(html, c.id, c.snippet);
    } catch (err) {
      log.push(`detail ${c.id} error: ${err instanceof Error ? err.message : String(err)}`);
      return null;
    }
  });

  const items = parsedItems.filter((item): item is PlanningAlertItem => item !== null);
  log.push(`Stored-eligible planning records: ${items.length}`);
  return { items, log };
}
