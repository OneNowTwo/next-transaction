/** Western Sydney industrial focus suburbs / postcodes for pilot filtering. */
export const WESTERN_SYDNEY_SUBURBS = [
  "Eastern Creek",
  "Erskine Park",
  "Wetherill Park",
  "Horsley Park",
  "Minchinbury",
  "Arndell Park",
  "Huntingwood",
  "Pemulwuy",
  "Prestons",
  "St Marys",
  "Mount Druitt",
  "Rooty Hill",
  "Seven Hills",
  "Blacktown",
  "Marsden Park",
  "Riverstone",
  "Kemps Creek",
  "Badgerys Creek",
  "Orchard Hills",
  "Smithfield",
  "Yennora",
  "Villawood",
  "Chipping Norton",
  "Moorebank",
  "Minto",
  "Ingleburn",
  "Padstow",
  "Revesby",
  "Milperra",
  "Bankstown",
  "Lidcombe",
  "Auburn",
  "Homebush",
  "Silverwater",
  "Rydalmere",
  "Rosehill",
  "Parramatta",
  "Greystanes",
  "Guildford",
  "Old Guildford",
  "Fairfield",
  "Prospect",
  "Girraween",
  "Pendle Hill",
  "Toongabbie",
  "Kings Park",
  "Kings Langley",
  "Quakers Hill",
  "Schofields",
  "Rouse Hill",
  "Box Hill",
  "Melonba",
  "Grantham Farm",
  "Dean Park",
  "Glendenning",
  "Plumpton",
  "Hassall Grove",
  "Colebee",
  "Tallawong",
  "The Ponds",
  "Emu Plains",
  "Penrith",
  "Jamisontown",
  "South Penrith",
  "Cambridge Park",
  "Cranebrook",
  "Llandilo",
  "Londonderry",
  "Castlereagh",
  "Erskine Park",
  "St Clair",
  "Colyton",
  "Oxley Park",
  "Claremont Meadows",
  "Jordan Springs",
  "Caddens",
  "Luddenham",
  "Bringelly",
  "Rossmore",
  "Austral",
  "Leppington",
  "Horningsea Park",
  "Carnes Hill",
  "Middleton Grange",
  "West Hoxton",
  "Cecil Hills",
  "Elizabeth Hills",
  "Hinchinbrook",
  "Miller",
  "Cartwright",
  "Sadleir",
  "Ashcroft",
  "Busby",
  "Green Valley",
  "Edmondson Park",
  "Denham Court",
  "Bardia",
  "Macquarie Fields",
  "Glenfield",
  "Casula",
  "Lurnea",
  "Prestons",
  "Horningsea Park",
  "Holroyd",
  "Chullora",
  "South Windsor",
  "Windsor",
  "Richmond",
  "North Richmond",
  "Bligh Park",
  "McGraths Hill",
  "Oakdale",
  "Leumeah",
  "Gregory Hills",
  "Smeaton Grange",
  "Narellan",
  "Oran Park",
  "Gledswood Hills",
  "Catherine Field",
  "Mulgoa",
  "Wallacia",
  "Glenmore Park",
  "Werrington",
  "Kingswood",
  "Doonside",
  "Parklea",
  "Merrylands",
  "Granville",
  "Chester Hill",
  "Condell Park",
  "Wattle Grove",
  "Holsworthy",
  "Campbelltown",
  "Berkshire Park",
  "Ropes Crossing",
  "Vineyard",
  "Regentville",
] as const;

export const INDUSTRIAL_KEYWORDS =
  /\b(warehouses?|warehousing|industrial|factories|factory|logistics|distribution\s*cent(?:re|er)s?|hardstand|freight|cold\s*stor(?:e|age)|self[-\s]?storage|data\s*cent(?:re|er)s?|manufacturing|manufactur(?:e|ing)|workshops?|truck\s*depot|transport\s*depot|storage\s*depot|bulky\s*goods|industrial\s*estate|industrial\s*building)\b/i;

/** Retail, housing and hospitality notices that mention a loose keyword but are not industrial leads. */
export const NON_INDUSTRIAL =
  /\b(dwelling|residential\s+flat|dual\s+occupancy|secondary\s+dwelling|granny\s+flat|child\s*care|childcare|group\s+home|tavern|pickleball|charcoal\s+chicken|food\s+premises|shop\s+fit|office\s+fit|retail\s+premises)\b/i;

const SUBURB_LOOKUP = [...WESTERN_SYDNEY_SUBURBS].sort(
  (a, b) => b.length - a.length
);

export function parseAustralianAddress(raw: string): {
  address: string;
  suburb: string | null;
  state: string | null;
  postcode: string | null;
} {
  const cleaned = raw
    .replace(/,/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/,$/, "");
  const tail = cleaned.match(/^(.*?)\s+(NSW|VIC|QLD|WA|SA|TAS|ACT|NT)\s+(\d{4})\s*$/i);
  if (!tail) {
    return { address: cleaned, suburb: null, state: null, postcode: null };
  }
  const head = tail[1].trim();
  const state = tail[2].toUpperCase();
  const postcode = tail[3];

  for (const suburb of SUBURB_LOOKUP) {
    const suffix = ` ${suburb.toLowerCase()}`;
    if (head.toLowerCase().endsWith(suffix)) {
      const address = head.slice(0, head.length - suburb.length).trim().replace(/,$/, "");
      return { address, suburb, state, postcode };
    }
  }

  // Fallback: last words as suburb, unless the word before that is a street type.
  const parts = head.split(" ");
  const streetType =
    /^(road|rd|street|st|avenue|ave|drive|dr|circuit|cct|parade|pde|place|pl|way|boulevard|blvd|lane|ln|close|cl|crescent|cres|court|ct)$/i;
  if (parts.length >= 3 && streetType.test(parts[parts.length - 2] || "")) {
    const suburb = parts[parts.length - 1];
    const address = parts.slice(0, -1).join(" ");
    if (address && suburb) return { address, suburb, state, postcode };
  }
  if (parts.length >= 2) {
    const suburb = parts.slice(-2).join(" ");
    const address = parts.slice(0, -2).join(" ");
    if (address) return { address, suburb, state, postcode };
  }

  return { address: head, suburb: null, state, postcode };
}

export function isWesternSydneySuburb(suburb: string | null | undefined): boolean {
  if (!suburb) return false;
  const s = suburb.trim().toLowerCase();
  return WESTERN_SYDNEY_SUBURBS.some((x) => x.toLowerCase() === s);
}

/** Longest known suburb name contained in free text (titles, headlines). */
export function findWesternSydneySuburb(text: string | null | undefined): string | null {
  if (!text) return null;
  const hay = ` ${text.toLowerCase()} `;
  for (const suburb of SUBURB_LOOKUP) {
    if (hay.includes(` ${suburb.toLowerCase()} `)) return suburb;
  }
  return null;
}

export function normalizeAddressKey(address: string, suburb?: string | null): string {
  return [address, suburb || ""]
    .join(" ")
    .toLowerCase()
    .replace(/\bunits?\b/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
