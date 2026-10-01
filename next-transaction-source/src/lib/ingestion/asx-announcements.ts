/**
 * Company announcements via the public Markit Digital feed used by asx.com.au.
 * Market-wide headlines plus a fixed list of industrial landlords.
 * A company-wide item is never attached to a warehouse without an explicit address.
 */

import { fetchJson } from "@/lib/ingestion/http";

export type AsxAnnouncementItem = {
  externalId: string;
  sourceUrl: string;
  publisher: string;
  title: string;
  excerpt: string;
  eventDate: Date | null;
  addressRaw: string | null;
  suburb: string | null;
  councilRef: string | null;
  companySymbol: string | null;
  signalHint: string;
  raw: Record<string, unknown>;
};

const PROPERTY_TICKERS = new Set(
  [
    "GPT",
    "DXS",
    "DXC",
    "CHC",
    "CIP",
    "CLW",
    "GOZ",
    "HDN",
    "BWP",
    "VCX",
    "SCG",
    "SGP",
    "CQR",
    "ABP",
    "CNI",
    "DXI",
    "GMG",
    "MGR",
    "ULL",
    "WPR",
    "APZ",
    "CDP",
    "HCW",
    "RGN",
    "REP",
  ].map((s) => s.toUpperCase())
);

/** Industrial / diversified landlords whose announcement feeds were verified (HTTP 200 JSON). */
const ISSUER_TICKERS = ["GMG", "CIP", "CLW", "GPT", "DXS", "CHC", "GOZ", "SGP", "MGR", "CNI", "APZ", "HDN"];

const RELEVANT =
  /\b(industrial|warehouse|logistics|portfolio|divest|dispos|acquisit|lease|leasing|property|real\s*estate|asset\s*sale|development\s*site|distribution|western\s*sydney|eastern\s*creek|wetherill|erskine\s*park|mamre|kemps\s*creek|moorebank)\b/i;

const ADMIN_ONLY =
  /\b(notice of meeting|change of director|appendix 3y|appendix 3z|ceasing to be a substantial|becoming a substantial)\b/i;

type RawAnnouncement = {
  documentKey?: string;
  headline?: string;
  date?: string;
  symbol?: string;
  isPriceSensitive?: boolean;
  announcementTypes?: string[];
  announcementType?: string;
  companyInfo?: Array<{ displayName?: string; symbol?: string }>;
};

function pdfUrl(documentKey: string): string {
  return `https://cdn-api.markitdigital.com/apiman-gateway/ASX/asx-research/1.0/file/${encodeURIComponent(
    documentKey
  )}`;
}

function toItem(
  row: RawAnnouncement,
  symbolHint: string | null,
  companyHint: string | null
): AsxAnnouncementItem | null {
  const symbol = (row.symbol || row.companyInfo?.[0]?.symbol || symbolHint || "").toUpperCase();
  const headline = row.headline || "";
  const company = row.companyInfo?.[0]?.displayName || companyHint || symbol;
  if (!row.documentKey || !headline) return null;

  const types = row.announcementTypes?.length
    ? row.announcementTypes
    : row.announcementType
      ? [row.announcementType]
      : [];

  const relevant =
    PROPERTY_TICKERS.has(symbol) || RELEVANT.test(`${headline} ${company} ${types.join(" ")}`);
  if (!relevant) return null;
  if (ADMIN_ONLY.test(headline) && !RELEVANT.test(headline)) return null;

  const addressMatch = headline.match(
    /\b(\d+[A-Za-z]?[\w\s\-']+?(?:Road|Rd|Street|St|Avenue|Ave|Drive|Dr|Circuit|Parade|Place|Way|Boulevard|Blvd))\b/i
  );

  const eventDate = row.date ? new Date(row.date) : null;
  const excerpt = [
    `${company} (${symbol}): ${headline}`,
    types.length ? `ASX types: ${types.join(", ")}.` : null,
    row.isPriceSensitive ? "Flagged price-sensitive." : null,
    addressMatch
      ? `Possible address mention in headline: ${addressMatch[1]}. Requires human confirmation before property matching.`
      : "No specific warehouse address in the headline — queued for review; not auto-attached to a property.",
  ]
    .filter(Boolean)
    .join(" ");

  return {
    externalId: row.documentKey,
    sourceUrl: pdfUrl(row.documentKey),
    publisher: "ASX (Markit Digital public feed)",
    title: `${symbol}: ${headline}`,
    excerpt,
    eventDate: eventDate && !Number.isNaN(eventDate.getTime()) ? eventDate : null,
    addressRaw: addressMatch?.[1] ?? null,
    suburb: null,
    councilRef: null,
    companySymbol: symbol || null,
    signalHint: /lease|leasing|tenant/i.test(headline)
      ? "portfolio_activity"
      : /dispos|divest|sale|sell/i.test(headline)
        ? "owner_disposal"
        : "portfolio_activity",
    raw: { ...row, symbol, company } as unknown as Record<string, unknown>,
  };
}

export async function fetchAsxAnnouncements(options?: {
  count?: number;
  issuerCount?: number;
}): Promise<{ items: AsxAnnouncementItem[]; log: string[] }> {
  const count = options?.count ?? 80;
  const issuerCount = options?.issuerCount ?? 12;
  const log: string[] = [];
  const items: AsxAnnouncementItem[] = [];
  const seen = new Set<string>();

  const marketUrl = `https://asx.api.markitdigital.com/asx-research/1.0/markets/announcements?count=${count}`;
  const market = await fetchJson<{
    data?: { items?: RawAnnouncement[] };
  }>(marketUrl);
  const marketRows = market.data?.items ?? [];
  log.push(`ASX market feed returned ${marketRows.length} announcements`);
  for (const row of marketRows) {
    const item = toItem(row, null, null);
    if (!item || seen.has(item.externalId)) continue;
    seen.add(item.externalId);
    items.push(item);
  }

  for (const symbol of ISSUER_TICKERS) {
    const url = `https://asx.api.markitdigital.com/asx-research/1.0/companies/${symbol}/announcements?count=${issuerCount}`;
    try {
      const json = await fetchJson<{
        data?: { displayName?: string; items?: RawAnnouncement[] };
      }>(url);
      const rows = json.data?.items ?? [];
      let kept = 0;
      for (const row of rows) {
        const item = toItem(row, symbol, json.data?.displayName || symbol);
        if (!item || seen.has(item.externalId)) continue;
        seen.add(item.externalId);
        items.push(item);
        kept += 1;
      }
      log.push(`${symbol}: ${rows.length} announcements, ${kept} new property-relevant`);
    } catch (err) {
      log.push(`${symbol} error: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  log.push(`Property-relevant ASX announcements kept: ${items.length}`);
  return { items, log };
}
