import { prisma } from "@/lib/db";
import { DEFAULT_RULES, recalculateWorkspaceOpportunities } from "@/lib/rules";
import { parseAustralianAddress } from "@/lib/geo";
import { fetchPlanningAlerts } from "@/lib/ingestion/planning-alerts";
import { fetchAsxAnnouncements } from "@/lib/ingestion/asx-announcements";
import { fetchMajorProjects } from "@/lib/ingestion/major-projects";
import { fetchIndustrialMedia } from "@/lib/ingestion/industrial-media";
import { matchIngestedToProperty } from "@/lib/ingestion/match";

type NormalizedItem = {
  prefix: string;
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
  sourceType: string;
  attach: "create" | "link-only";
  verificationStatus: "verified" | "unverified";
  placeNote: string;
  raw: Record<string, unknown>;
};

function isUniqueConstraint(err: unknown) {
  return Boolean(
    err && typeof err === "object" && "code" in err && (err as { code?: string }).code === "P2002"
  );
}

async function ensureLiveWorkspace() {
  let live = await prisma.workspace.findFirst({ where: { mode: "live" } });
  if (!live) {
    live = await prisma.workspace.create({
      data: { name: "Live pilot", mode: "live", isFictional: false },
    });
  }
  for (const rule of DEFAULT_RULES) {
    try {
      await prisma.rule.upsert({
        where: { workspaceId_key: { workspaceId: live.id, key: rule.key } },
        create: { workspaceId: live.id, ...rule, enabled: true },
        update: {},
      });
    } catch (err) {
      if (!isUniqueConstraint(err)) throw err;
    }
  }
  return live;
}

export async function ensureConnectors() {
  const defs = [
    {
      key: "planning_alerts_ws",
      name: "Planning Alerts (Western Sydney LGAs)",
      sourceType: "planning",
      publisher: "Planning Alerts / OpenAustralia Foundation",
      configJson: JSON.stringify({
        authorities: [
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
        ],
        pages: 3,
        licenseNote: "Public HTML of council DAs republished by Planning Alerts.",
      }),
    },
    {
      key: "nsw_major_projects",
      name: "NSW major projects (industrial)",
      sourceType: "planning",
      publisher: "NSW Planning Portal",
      configJson: JSON.stringify({
        endpoint: "https://www.planningportal.nsw.gov.au/major-projects/projects",
        filters: ["Warehouse or distribution centres", "Data Storage"],
        licenseNote: "Public major-project pages. Street is stored only when the page publishes one.",
      }),
    },
    {
      key: "asx_announcements",
      name: "ASX company announcements (property-relevant)",
      sourceType: "company_announcement",
      publisher: "ASX via Markit Digital public feed",
      configJson: JSON.stringify({
        market: "https://asx.api.markitdigital.com/asx-research/1.0/markets/announcements",
        issuers: ["GMG", "CIP", "CLW", "GPT", "DXS", "CHC", "GOZ", "SGP", "MGR", "CNI", "APZ", "HDN"],
        licenseNote: "Public market disclosures. No warehouse is created from a company-wide headline.",
      }),
    },
    {
      key: "ws_industrial_media",
      name: "Western Sydney industrial media",
      sourceType: "news",
      publisher: "Google News RSS (publisher named on each item)",
      configJson: JSON.stringify({
        endpoint: "https://news.google.com/rss/search",
        query: "western sydney warehouse industrial logistics",
        licenseNote:
          "Public news headlines. Items without a street address stay in the review queue.",
      }),
    },
  ];

  const out = [];
  for (const d of defs) {
    out.push(
      await prisma.sourceConnector.upsert({
        where: { key: d.key },
        create: { ...d, status: "idle" },
        update: { name: d.name, publisher: d.publisher, configJson: d.configJson, sourceType: d.sourceType },
      })
    );
  }
  return out;
}

async function upsertEvidenceAndProperty(opts: {
  workspaceId: string;
  addressRaw: string;
  suburb: string | null;
  councilRef: string | null;
  title: string;
  url: string;
  excerpt: string;
  eventDate: Date | null;
  signalCategory: string;
  sourceType: string;
  eventKey: string;
  verificationStatus: "verified" | "unverified";
  placeNote: string;
  propertyId?: string;
}) {
  let propertyId = opts.propertyId;
  const parsed = parseAustralianAddress(opts.addressRaw);
  const suburb = opts.suburb || parsed.suburb || "Unknown";
  const street = parsed.address || opts.addressRaw;

  if (!propertyId) {
    const importKey = (opts.councilRef || `live-${opts.eventKey}`).slice(0, 80);
    try {
      const created = await prisma.property.create({
        data: {
          workspaceId: opts.workspaceId,
          address: street.slice(0, 240),
          suburb: suburb.slice(0, 80),
          propertyType: "Industrial",
          ownerEntity: null,
          tenant: null,
          leaseExpiry: null,
          lastSaleDate: null,
          isFictional: false,
          importKey,
          relationshipNotes: opts.placeNote,
        },
      });
      propertyId = created.id;
    } catch (err) {
      if (!isUniqueConstraint(err)) throw err;
      const existing = await prisma.property.findFirst({
        where: { workspaceId: opts.workspaceId, importKey },
      });
      if (!existing) throw err;
      propertyId = existing.id;
    }
  }

  const existingEvidence = await prisma.evidence.findFirst({
    where: { workspaceId: opts.workspaceId, eventKey: opts.eventKey },
  });
  if (existingEvidence) {
    return { propertyId, evidenceId: existingEvidence.id, created: false };
  }

  const evidence = await prisma.evidence.create({
    data: {
      workspaceId: opts.workspaceId,
      propertyId,
      signalCategory: opts.signalCategory,
      sourceTitle: opts.title.slice(0, 300),
      sourceUrl: opts.url,
      excerpt: opts.excerpt,
      eventDate: opts.eventDate,
      collectedAt: new Date(),
      sourceType: opts.sourceType,
      verificationStatus: opts.verificationStatus,
      eventKey: opts.eventKey,
      isFictional: false,
    },
  });
  return { propertyId, evidenceId: evidence.id, created: true };
}

async function storeItems(opts: {
  connectorId: string;
  workspaceId: string;
  items: NormalizedItem[];
}) {
  let created = 0;
  let duplicates = 0;

  for (const item of opts.items) {
    const dedupeKey = `${item.prefix}:${item.externalId}`.slice(0, 180);
    const existing = await prisma.ingestedRecord.findUnique({ where: { dedupeKey } });
    if (existing) {
      duplicates += 1;
      continue;
    }

    const match = await matchIngestedToProperty({
      workspaceId: opts.workspaceId,
      addressRaw: item.addressRaw,
      suburb: item.suburb,
      councilRef: item.councilRef,
      companySymbol: item.companySymbol,
      requireAddress: true,
    });

    let matchStatus = "review";
    let propertyId: string | null = null;
    let evidenceId: string | null = null;
    let reviewReason =
      match.status === "review"
        ? match.reason
        : "Stored without automatic property attachment.";
    let candidatePropertyId = match.status === "review" ? match.candidatePropertyId : undefined;

    const shouldAttach =
      Boolean(item.addressRaw) &&
      (item.attach === "create"
        ? match.status === "matched" || match.status === "unmatched"
        : match.status === "matched");

    if (shouldAttach && item.addressRaw) {
      const linked = await upsertEvidenceAndProperty({
        workspaceId: opts.workspaceId,
        addressRaw: item.addressRaw,
        suburb: item.suburb,
        councilRef: item.councilRef,
        title: item.title,
        url: item.sourceUrl,
        excerpt: item.excerpt,
        eventDate: item.eventDate,
        signalCategory: item.signalHint,
        sourceType: item.sourceType,
        eventKey: dedupeKey,
        verificationStatus: item.verificationStatus,
        placeNote: item.placeNote,
        propertyId: match.status === "matched" ? match.propertyId : undefined,
      });
      propertyId = linked.propertyId;
      evidenceId = linked.evidenceId;
      matchStatus = "matched";
      if (linked.created) created += 1;
      else duplicates += 1;
    } else {
      matchStatus = "review";
      created += 1;
      if (match.status === "unmatched") reviewReason = match.reason;
      if (!item.addressRaw) {
        reviewReason =
          "No explicit street address on the source. Not attached to a warehouse.";
      }
    }

    try {
      const record = await prisma.ingestedRecord.create({
        data: {
          connectorId: opts.connectorId,
          workspaceId: opts.workspaceId,
          externalId: item.externalId.slice(0, 180),
          dedupeKey,
          sourceUrl: item.sourceUrl,
          publisher: item.publisher.slice(0, 180),
          title: item.title.slice(0, 300),
          excerpt: item.excerpt,
          eventDate: item.eventDate,
          addressRaw: item.addressRaw,
          suburb: item.suburb,
          councilRef: item.councilRef,
          companySymbol: item.companySymbol,
          signalHint: item.signalHint,
          rawJson: JSON.stringify(item.raw).slice(0, 20000),
          matchStatus,
          propertyId,
          evidenceId,
        },
      });

      if (matchStatus === "review") {
        await prisma.matchReview.create({
          data: {
            workspaceId: opts.workspaceId,
            ingestedRecordId: record.id,
            reason: reviewReason,
            candidatePropertyId,
            status: "pending",
          },
        });
      }
    } catch (err) {
      if (isUniqueConstraint(err)) {
        duplicates += 1;
        continue;
      }
      throw err;
    }
  }

  return { created, duplicates };
}

async function loadItems(key: string): Promise<{ items: NormalizedItem[]; log: string[] }> {
  if (key === "planning_alerts_ws") {
    const { items, log } = await fetchPlanningAlerts({ maxPagesPerAuthority: 3, maxDetails: 48 });
    return {
      log,
      items: items.map((item) => ({
        prefix: "planning",
        externalId: item.externalId,
        sourceUrl: item.sourceUrl,
        publisher: item.publisher,
        title: item.title,
        excerpt: item.excerpt,
        eventDate: item.eventDate,
        addressRaw: item.addressRaw,
        suburb: item.suburb,
        councilRef: item.councilRef,
        companySymbol: null,
        signalHint: item.signalHint,
        sourceType: "planning",
        attach: "create" as const,
        verificationStatus: "verified" as const,
        placeNote:
          "Created from a Planning Alerts application page. Owner, tenant and lease were not stated on that page and are Unknown.",
        raw: item.raw,
      })),
    };
  }

  if (key === "nsw_major_projects") {
    const { items, log } = await fetchMajorProjects({ maxDetails: 36 });
    return {
      log,
      items: items.map((item) => ({
        prefix: "major",
        externalId: item.externalId,
        sourceUrl: item.sourceUrl,
        publisher: item.publisher,
        title: item.title,
        excerpt: item.excerpt,
        eventDate: item.eventDate,
        addressRaw: item.addressRaw,
        suburb: item.suburb,
        councilRef: item.councilRef,
        companySymbol: null,
        signalHint: item.signalHint,
        sourceType: "planning",
        attach: "create" as const,
        verificationStatus: "verified" as const,
        placeNote:
          "Created from an NSW Planning Portal major-project page. Owner, tenant and lease were not stated and are Unknown. If the address is the project name, the page did not publish a street.",
        raw: item.raw,
      })),
    };
  }

  if (key === "asx_announcements") {
    const { items, log } = await fetchAsxAnnouncements({ count: 80, issuerCount: 12 });
    return {
      log,
      items: items.map((item) => ({
        prefix: "asx",
        externalId: item.externalId,
        sourceUrl: item.sourceUrl,
        publisher: item.publisher,
        title: item.title,
        excerpt: item.excerpt,
        eventDate: item.eventDate,
        addressRaw: item.addressRaw,
        suburb: item.suburb,
        councilRef: null,
        companySymbol: item.companySymbol,
        signalHint: item.signalHint,
        sourceType: "company_announcement",
        attach: "link-only" as const,
        verificationStatus: "verified" as const,
        placeNote:
          "Linked from an ASX announcement that matched an existing address. Ownership and lease are not taken from the headline.",
        raw: item.raw,
      })),
    };
  }

  if (key === "ws_industrial_media") {
    const { items, log } = await fetchIndustrialMedia({ maxItems: 18 });
    return {
      log,
      items: items.map((item) => ({
        prefix: "media",
        externalId: item.externalId,
        sourceUrl: item.sourceUrl,
        publisher: item.publisher,
        title: item.title,
        excerpt: item.excerpt,
        eventDate: item.eventDate,
        addressRaw: item.addressRaw,
        suburb: item.suburb,
        councilRef: null,
        companySymbol: null,
        signalHint: item.signalHint,
        sourceType: "news",
        attach:
          item.addressRaw && item.suburb ? ("create" as const) : ("link-only" as const),
        verificationStatus: "unverified" as const,
        placeNote:
          "Created from a news headline that included a street. Confirm the address on the article. Owner, tenant and lease are Unknown.",
        raw: item.raw,
      })),
    };
  }

  throw new Error(`Unsupported connector ${key}`);
}

export async function runConnector(key: string) {
  await ensureConnectors();
  const live = await ensureLiveWorkspace();
  const connector = await prisma.sourceConnector.findUnique({ where: { key } });
  if (!connector) throw new Error(`Unknown connector ${key}`);

  const run = await prisma.ingestionRun.create({
    data: { connectorId: connector.id, status: "running" },
  });
  await prisma.sourceConnector.update({
    where: { id: connector.id },
    data: { status: "running", lastAttemptAt: new Date(), lastError: null },
  });

  const logs: string[] = [];
  let retrieved = 0;
  let created = 0;
  let duplicates = 0;

  try {
    const loaded = await loadItems(key);
    logs.push(...loaded.log);
    retrieved = loaded.items.length;
    const stored = await storeItems({
      connectorId: connector.id,
      workspaceId: live.id,
      items: loaded.items,
    });
    created = stored.created;
    duplicates = stored.duplicates;
    await recalculateWorkspaceOpportunities(live.id);

    await prisma.ingestionRun.update({
      where: { id: run.id },
      data: {
        status: "success",
        finishedAt: new Date(),
        retrievedCount: retrieved,
        createdCount: created,
        duplicateCount: duplicates,
        logJson: JSON.stringify(logs),
      },
    });
    await prisma.sourceConnector.update({
      where: { id: connector.id },
      data: {
        status: "ok",
        lastSuccessAt: new Date(),
        lastRetrievedCount: retrieved,
        lastError: null,
      },
    });

    return { ok: true, retrieved, created, duplicates, logs, workspaceId: live.id };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logs.push(message);
    await prisma.ingestionRun.update({
      where: { id: run.id },
      data: {
        status: "error",
        finishedAt: new Date(),
        retrievedCount: retrieved,
        createdCount: created,
        duplicateCount: duplicates,
        errorMessage: message.slice(0, 500),
        logJson: JSON.stringify(logs),
      },
    });
    await prisma.sourceConnector.update({
      where: { id: connector.id },
      data: { status: "error", lastError: message.slice(0, 500) },
    });
    return { ok: false, error: message, retrieved, created, duplicates, logs, workspaceId: live.id };
  }
}

export async function liveIngestSummary(workspaceId: string) {
  const [records, matched, review, opportunities, properties] = await Promise.all([
    prisma.ingestedRecord.count({ where: { workspaceId } }),
    prisma.ingestedRecord.count({ where: { workspaceId, matchStatus: "matched" } }),
    prisma.ingestedRecord.count({ where: { workspaceId, matchStatus: "review" } }),
    prisma.opportunity.count({ where: { workspaceId, isFictional: false } }),
    prisma.property.count({ where: { workspaceId, isFictional: false } }),
  ]);
  const byConnector = await prisma.sourceConnector.findMany({
    select: { key: true, status: true, lastRetrievedCount: true, lastError: true },
    orderBy: { name: "asc" },
  });
  return { records, matched, review, opportunities, properties, byConnector };
}

export async function runAllConnectors() {
  await ensureConnectors();
  const planning = await runConnector("planning_alerts_ws");
  const major = await runConnector("nsw_major_projects");
  const asx = await runConnector("asx_announcements");
  const media = await runConnector("ws_industrial_media");
  const workspaceId =
    (planning.ok && planning.workspaceId) ||
    (major.ok && major.workspaceId) ||
    (asx.ok && asx.workspaceId) ||
    (media.ok && media.workspaceId) ||
    null;
  const summary = workspaceId ? await liveIngestSummary(workspaceId) : null;
  return { planning, major, asx, media, summary };
}
