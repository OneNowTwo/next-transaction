/**
 * Public media RSS for Western Sydney industrial news.
 * Verified Oct 2026: Google News RSS search returns items with title, date and publisher.
 * Links are the RSS item links (often a Google News redirect). Headlines without a street
 * address stay in the review queue — they are not turned into properties.
 */

import * as cheerio from "cheerio";
import { findWesternSydneySuburb, INDUSTRIAL_KEYWORDS } from "@/lib/geo";
import { fetchText } from "@/lib/ingestion/http";

export type MediaItem = {
  externalId: string;
  sourceUrl: string;
  publisher: string;
  title: string;
  excerpt: string;
  eventDate: Date | null;
  addressRaw: string | null;
  suburb: string | null;
  signalHint: string;
  raw: Record<string, unknown>;
};

const PLACE =
  /\b(western sydney|blacktown|penrith|liverpool|fairfield|parramatta|cumberland|camden|eastern creek|wetherill|erskine|kemps creek|moorebank|prestons|auburn|lidcombe|smithfield|yennora|chullora|mamre|luddenham|horsley|huntingwood|minchinbury|arndell|badgerys|marsden park|orchard hills|oakdale)\b/i;

const STREET =
  /\b(\d+[A-Za-z]?(?:\s*[-–]\s*\d+[A-Za-z]?)?\s+[A-Za-z][\w\s'\-]{2,40}?(?:Road|Rd|Street|St|Avenue|Ave|Drive|Dr|Place|Way))\b/i;

function hashKey(value: string): string {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (Math.imul(31, hash) + value.charCodeAt(i)) | 0;
  }
  return Math.abs(hash).toString(36);
}

export async function fetchIndustrialMedia(options?: {
  maxItems?: number;
}): Promise<{ items: MediaItem[]; log: string[] }> {
  const maxItems = options?.maxItems ?? 18;
  const log: string[] = [];
  const query = encodeURIComponent(
    '"western sydney" (warehouse OR "industrial estate" OR "industrial site" OR logistics OR "distribution centre" OR "for lease" OR "for sale") when:90d'
  );
  const url = `https://news.google.com/rss/search?q=${query}&hl=en-AU&gl=AU&ceid=AU:en`;
  const xml = await fetchText(url, "application/rss+xml, application/xml, text/xml");
  const $ = cheerio.load(xml, { xmlMode: true });
  const items: MediaItem[] = [];

  $("item").each((_, el) => {
    if (items.length >= maxItems) return;
    const title = $(el).find("title").first().text().replace(/\s+/g, " ").trim();
    const link = $(el).find("link").first().text().trim();
    const pubDate = $(el).find("pubDate").first().text().trim();
    const publisher = $(el).find("source").first().text().replace(/\s+/g, " ").trim() || "Google News RSS";
    if (!title || !link) return;
    if (!INDUSTRIAL_KEYWORDS.test(title) && !/\b(for sale|for lease|industrial estate|warehouse)\b/i.test(title)) {
      return;
    }
    if (!PLACE.test(title)) return;

    const eventDate = pubDate ? new Date(pubDate) : null;
    const suburb = findWesternSydneySuburb(title);
    const street = title.match(STREET)?.[1] ?? null;
    const hint = /\bfor sale\b|\bsale\b/i.test(title)
      ? "owner_disposal"
      : /\blease\b/i.test(title)
        ? "public_listing"
        : "portfolio_activity";

    items.push({
      externalId: hashKey(link || title),
      sourceUrl: link,
      publisher,
      title,
      excerpt: [
        `${publisher}: ${title}`,
        suburb ? `Suburb named in the headline: ${suburb}.` : "No specific suburb parsed from the headline.",
        street
          ? `Possible street in the headline: ${street}. Still treated carefully — a news headline is not a title search.`
          : "No street address in the headline. Stored for review and not attached to a warehouse.",
        "News coverage is not proof of a leasing or sale instruction.",
      ].join(" "),
      eventDate: eventDate && !Number.isNaN(eventDate.getTime()) ? eventDate : null,
      addressRaw: street,
      suburb,
      signalHint: hint,
      raw: { title, link, pubDate, publisher },
    });
  });

  log.push(`Google News RSS kept ${items.length} Western Sydney industrial headlines (cap ${maxItems})`);
  return { items, log };
}
