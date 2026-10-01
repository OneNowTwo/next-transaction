import * as cheerio from "cheerio";
import {
  INDUSTRIAL_KEYWORDS,
  isWesternSydneySuburb,
  parseAustralianAddress,
} from "@/lib/geo";

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

const UA = "NextTransactionPilot/1.0 (+local research; planningalerts public HTML)";
const AUTHORITIES = ["blacktown", "penrith", "fairfield", "liverpool", "campbelltown"];

async function fetchText(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: { "User-Agent": UA, Accept: "text/html" },
    next: { revalidate: 0 },
  });
  if (!res.ok) throw new Error(`Planning Alerts HTTP ${res.status} for ${url}`);
  return res.text();
}

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

function parseDetail(html: string, id: string): PlanningAlertItem | null {
  const $ = cheerio.load(html);
  const addressRaw = $("h1").first().text().replace(/\s+/g, " ").trim();
  if (!addressRaw) return null;

  const field = (label: string): string | null => {
    let value: string | null = null;
    $("dt").each((_, el) => {
      if ($(el).text().trim().toLowerCase() === label.toLowerCase()) {
        const raw = $(el).next("dd").text().replace(/\s+/g, " ").trim();
        // Planning Alerts appends help text after the reference value.
        const cleaned = raw.replace(/\s+Info\b.*/i, "").trim();
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
  const suburb = parsed.suburb;
  const blob = `${addressRaw} ${description}`;
  const industrial = INDUSTRIAL_KEYWORDS.test(blob);
  const inWs = isWesternSydneySuburb(suburb) || /\bNSW\b/i.test(addressRaw);

  // Keep Western Sydney industrial-ish OR industrial keywords in WS LGA pages we already scoped
  if (!inWs && !industrial) return null;
  if (!industrial && suburb && !isWesternSydneySuburb(suburb)) return null;
  // Prefer industrial keywords; still allow WS industrial precinct suburbs with commercial/office fitout etc. only if industrial keyword present
  if (!industrial) return null;

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
  const maxPages = options?.maxPagesPerAuthority ?? 2;
  const maxDetails = options?.maxDetails ?? 40;
  const log: string[] = [];
  const candidates: Array<{ id: string; snippet: string; authority: string }> = [];

  for (const authority of AUTHORITIES) {
    for (let page = 1; page <= maxPages; page += 1) {
      const url =
        page === 1
          ? `https://www.planningalerts.org.au/authorities/${authority}/applications`
          : `https://www.planningalerts.org.au/authorities/${authority}/applications?page=${page}`;
      try {
        const html = await fetchText(url);
        const list = parseListPage(html);
        log.push(`${authority} page ${page}: ${list.length} listings`);
        for (const item of list) {
          const parsed = parseAustralianAddress(item.snippet.split("  ")[0] || item.snippet);
          // Heuristic from snippet: industrial keywords OR known WS industrial suburb in text
          const interesting =
            INDUSTRIAL_KEYWORDS.test(item.snippet) ||
            /\b(Eastern Creek|Erskine Park|Wetherill Park|Horsley Park|Huntingwood|Minchinbury|Arndell Park|Prestons|Kemps Creek)\b/i.test(
              item.snippet
            );
          if (interesting) {
            candidates.push({ ...item, authority });
          } else if (parsed.suburb && isWesternSydneySuburb(parsed.suburb) && INDUSTRIAL_KEYWORDS.test(item.snippet)) {
            candidates.push({ ...item, authority });
          }
        }
      } catch (err) {
        log.push(
          `${authority} page ${page} error: ${err instanceof Error ? err.message : String(err)}`
        );
      }
    }
  }

  // Always include unique candidate ids; cap detail fetches
  const unique = Array.from(new Map(candidates.map((c) => [c.id, c])).values()).slice(
    0,
    maxDetails
  );
  log.push(`Detail fetch candidates: ${unique.length}`);

  const items: PlanningAlertItem[] = [];
  for (const c of unique) {
    try {
      // Be polite to Planning Alerts — avoid burst 429s.
      await new Promise((r) => setTimeout(r, 350));
      const html = await fetchText(`https://www.planningalerts.org.au/applications/${c.id}`);
      const parsed = parseDetail(html, c.id);
      if (parsed) items.push(parsed);
    } catch (err) {
      log.push(
        `detail ${c.id} error: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }

  log.push(`Stored-eligible planning records: ${items.length}`);
  return { items, log };
}
