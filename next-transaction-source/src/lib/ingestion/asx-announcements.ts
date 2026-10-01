/**
 * Company announcements via the public Markit Digital feed used by asx.com.au.
 * Permitted use: public market disclosures. We only keep property/industrial-relevant
 * headlines and never invent a warehouse link without an explicit address.
 */

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

const RELEVANT =
  /\b(industrial|warehouse|logistics|portfolio|divest|dispos|acquisit|lease|leasing|property|real\s*estate|asset\s*sale|development\s*site|western\s*sydney|eastern\s*creek|wetherill|erskine\s*park)\b/i;

function pdfUrl(documentKey: string): string {
  // Public ASX PDF pattern used by the website
  return `https://cdn-api.markitdigital.com/apiman-gateway/ASX/asx-research/1.0/file/${encodeURIComponent(
    documentKey
  )}?access_token=`;
}

export async function fetchAsxAnnouncements(options?: {
  count?: number;
}): Promise<{ items: AsxAnnouncementItem[]; log: string[] }> {
  const count = options?.count ?? 100;
  const log: string[] = [];
  const url = `https://asx.api.markitdigital.com/asx-research/1.0/markets/announcements?count=${count}`;
  const res = await fetch(url, {
    headers: {
      Accept: "application/json",
      "User-Agent": "NextTransactionPilot/1.0",
    },
    next: { revalidate: 0 },
  });
  if (!res.ok) throw new Error(`ASX announcements HTTP ${res.status}`);
  const json = (await res.json()) as {
    data?: {
      items?: Array<{
        documentKey?: string;
        headline?: string;
        date?: string;
        symbol?: string;
        isPriceSensitive?: boolean;
        announcementTypes?: string[];
        companyInfo?: Array<{ displayName?: string; symbol?: string }>;
      }>;
    };
  };

  const rows = json.data?.items ?? [];
  log.push(`ASX feed returned ${rows.length} announcements`);

  const items: AsxAnnouncementItem[] = [];
  for (const row of rows) {
    const symbol = (row.symbol || row.companyInfo?.[0]?.symbol || "").toUpperCase();
    const headline = row.headline || "";
    const company = row.companyInfo?.[0]?.displayName || symbol;
    const relevant =
      PROPERTY_TICKERS.has(symbol) || RELEVANT.test(`${headline} ${company}`);
    if (!relevant || !row.documentKey) continue;

    // Address extraction is rare in headlines; leave unmatched for review unless explicit.
    const addressMatch = headline.match(
      /\b(\d+[A-Za-z]?[\w\s\-']+?(?:Road|Rd|Street|St|Avenue|Ave|Drive|Dr|Circuit|Parade|Place|Way|Boulevard|Blvd))\b/i
    );

    const eventDate = row.date ? new Date(row.date) : null;
    const sourceUrl = pdfUrl(row.documentKey);
    const excerpt = [
      `${company} (${symbol}): ${headline}`,
      row.announcementTypes?.length
        ? `ASX types: ${row.announcementTypes.join(", ")}.`
        : null,
      row.isPriceSensitive ? "Flagged price-sensitive." : null,
      addressMatch
        ? `Possible address mention in headline: ${addressMatch[1]}. Requires human confirmation before property matching.`
        : "No specific warehouse address in the headline — queued for review; not auto-attached to a property.",
    ]
      .filter(Boolean)
      .join(" ");

    items.push({
      externalId: row.documentKey,
      sourceUrl,
      publisher: "ASX (Markit Digital public feed)",
      title: `${symbol}: ${headline}`,
      excerpt,
      eventDate,
      addressRaw: addressMatch?.[1] ?? null,
      suburb: null,
      councilRef: null,
      companySymbol: symbol || null,
      signalHint: /lease|leasing|tenant/i.test(headline)
        ? "portfolio_activity"
        : /dispos|divest|sale|sell/i.test(headline)
          ? "owner_disposal"
          : "portfolio_activity",
      raw: row as unknown as Record<string, unknown>,
    });
  }

  log.push(`Property-relevant ASX announcements kept: ${items.length}`);
  return { items, log };
}
