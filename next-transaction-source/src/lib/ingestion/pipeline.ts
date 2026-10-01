import { prisma } from "@/lib/db";
import { DEFAULT_RULES, recalculateWorkspaceOpportunities } from "@/lib/rules";
import { parseAustralianAddress } from "@/lib/geo";
import { fetchPlanningAlerts } from "@/lib/ingestion/planning-alerts";
import { fetchAsxAnnouncements } from "@/lib/ingestion/asx-announcements";
import { matchIngestedToProperty } from "@/lib/ingestion/match";

async function ensureLiveWorkspace() {
  let live = await prisma.workspace.findFirst({ where: { mode: "live" } });
  if (!live) {
    live = await prisma.workspace.create({
      data: {
        name: "Live pilot",
        mode: "live",
        isFictional: false,
      },
    });
  }
  for (const rule of DEFAULT_RULES) {
    await prisma.rule.upsert({
      where: { workspaceId_key: { workspaceId: live.id, key: rule.key } },
      create: { workspaceId: live.id, ...rule, enabled: true },
      update: {},
    });
  }
  return live;
}

async function ensureConnectors() {
  const defs = [
    {
      key: "planning_alerts_ws",
      name: "Planning Alerts (Western Sydney LGAs)",
      sourceType: "planning",
      publisher: "Planning Alerts / OpenAustralia Foundation",
      configJson: JSON.stringify({
        authorities: ["blacktown", "penrith", "fairfield", "liverpool", "campbelltown"],
        licenseNote:
          "Public HTML listings of council DAs republished by Planning Alerts. Civic open data.",
      }),
    },
    {
      key: "asx_announcements",
      name: "ASX company announcements (property-relevant)",
      sourceType: "company_announcement",
      publisher: "ASX via Markit Digital public feed",
      configJson: JSON.stringify({
        endpoint:
          "https://asx.api.markitdigital.com/asx-research/1.0/markets/announcements",
        licenseNote:
          "Public market disclosures. Company-wide news is not attached to a warehouse without an address link.",
      }),
    },
  ];
  const out = [];
  for (const d of defs) {
    out.push(
      await prisma.sourceConnector.upsert({
        where: { key: d.key },
        create: { ...d, status: "idle" },
        update: {
          name: d.name,
          publisher: d.publisher,
          configJson: d.configJson,
        },
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
  propertyId?: string;
}) {
  let propertyId = opts.propertyId;
  const parsed = parseAustralianAddress(opts.addressRaw);
  const suburb = opts.suburb || parsed.suburb || "Unknown";
  const street = parsed.address || opts.addressRaw;

  if (!propertyId) {
    const created = await prisma.property.create({
      data: {
        workspaceId: opts.workspaceId,
        address: street,
        suburb,
        propertyType: "Industrial",
        ownerEntity: null,
        tenant: null,
        leaseExpiry: null,
        lastSaleDate: null,
        isFictional: false,
        importKey: (opts.councilRef || `live-${opts.eventKey}`).slice(0, 80),
        relationshipNotes:
          "Created from genuine ingested planning record. Owner/tenant/lease Unknown unless a public source states them.",
      },
    });
    propertyId = created.id;
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
      sourceTitle: opts.title,
      sourceUrl: opts.url,
      excerpt: opts.excerpt,
      eventDate: opts.eventDate,
      collectedAt: new Date(),
      sourceType: opts.sourceType,
      verificationStatus: "verified",
      eventKey: opts.eventKey,
      isFictional: false,
    },
  });
  return { propertyId, evidenceId: evidence.id, created: true };
}

export async function runConnector(key: string) {
  await ensureConnectors();
  const live = await ensureLiveWorkspace();
  const connector = await prisma.sourceConnector.findUnique({ where: { key } });
  if (!connector) throw new Error(`Unknown connector ${key}`);

  const run = await prisma.ingestionRun.create({
    data: {
      connectorId: connector.id,
      status: "running",
    },
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
    if (key === "planning_alerts_ws") {
      const { items, log } = await fetchPlanningAlerts({
        maxPagesPerAuthority: 3,
        maxDetails: 50,
      });
      logs.push(...log);
      retrieved = items.length;

      for (const item of items) {
        const dedupeKey = `planning:${item.externalId}`;
        const existing = await prisma.ingestedRecord.findUnique({
          where: { dedupeKey },
        });
        if (existing) {
          duplicates += 1;
          continue;
        }

        const match = await matchIngestedToProperty({
          workspaceId: live.id,
          addressRaw: item.addressRaw,
          suburb: item.suburb,
          councilRef: item.councilRef,
        });

        let propertyId: string | undefined =
          match.status === "matched" ? match.propertyId : undefined;
        let matchStatus = match.status === "matched" ? "matched" : match.status;
        let evidenceId: string | undefined;

        if (match.status === "matched" || match.status === "unmatched") {
          const linked = await upsertEvidenceAndProperty({
            workspaceId: live.id,
            addressRaw: item.addressRaw,
            suburb: item.suburb,
            councilRef: item.councilRef,
            title: item.title,
            url: item.sourceUrl,
            excerpt: item.excerpt,
            eventDate: item.eventDate,
            signalCategory: item.signalHint,
            sourceType: "planning",
            eventKey: dedupeKey,
            propertyId,
          });
          propertyId = linked.propertyId;
          evidenceId = linked.evidenceId;
          matchStatus = "matched";
          if (linked.created) created += 1;
          else duplicates += 1;
        }

        const record = await prisma.ingestedRecord.create({
          data: {
            connectorId: connector.id,
            workspaceId: live.id,
            externalId: item.externalId,
            dedupeKey,
            sourceUrl: item.sourceUrl,
            publisher: item.publisher,
            title: item.title,
            excerpt: item.excerpt,
            eventDate: item.eventDate,
            addressRaw: item.addressRaw,
            suburb: item.suburb,
            councilRef: item.councilRef,
            signalHint: item.signalHint,
            rawJson: JSON.stringify(item.raw),
            matchStatus,
            propertyId: propertyId ?? null,
            evidenceId: evidenceId ?? null,
          },
        });

        if (match.status === "review") {
          await prisma.matchReview.create({
            data: {
              workspaceId: live.id,
              ingestedRecordId: record.id,
              reason: match.reason,
              candidatePropertyId: match.candidatePropertyId,
              status: "pending",
            },
          });
        }
      }

      await recalculateWorkspaceOpportunities(live.id);
    } else if (key === "asx_announcements") {
      const { items, log } = await fetchAsxAnnouncements({ count: 120 });
      logs.push(...log);
      retrieved = items.length;

      for (const item of items) {
        const dedupeKey = `asx:${item.externalId}`;
        const existing = await prisma.ingestedRecord.findUnique({
          where: { dedupeKey },
        });
        if (existing) {
          duplicates += 1;
          continue;
        }

        const match = await matchIngestedToProperty({
          workspaceId: live.id,
          addressRaw: item.addressRaw,
          suburb: item.suburb,
          companySymbol: item.companySymbol,
          requireAddress: true,
        });

        // Never auto-create a warehouse from a company headline alone.
        let matchStatus: string = "review";
        let propertyId: string | null = null;
        let evidenceId: string | null = null;

        if (match.status === "matched" && item.addressRaw) {
          const linked = await upsertEvidenceAndProperty({
            workspaceId: live.id,
            addressRaw: item.addressRaw,
            suburb: item.suburb,
            councilRef: null,
            title: item.title,
            url: item.sourceUrl,
            excerpt: item.excerpt,
            eventDate: item.eventDate,
            signalCategory: item.signalHint,
            sourceType: "company_announcement",
            eventKey: dedupeKey,
            propertyId: match.propertyId,
          });
          propertyId = linked.propertyId;
          evidenceId = linked.evidenceId;
          matchStatus = "matched";
          if (linked.created) created += 1;
        } else {
          matchStatus = "review";
          created += 1; // new ingested record awaiting review
        }

        const record = await prisma.ingestedRecord.create({
          data: {
            connectorId: connector.id,
            workspaceId: live.id,
            externalId: item.externalId,
            dedupeKey,
            sourceUrl: item.sourceUrl,
            publisher: item.publisher,
            title: item.title,
            excerpt: item.excerpt,
            eventDate: item.eventDate,
            addressRaw: item.addressRaw,
            suburb: item.suburb,
            companySymbol: item.companySymbol,
            signalHint: item.signalHint,
            rawJson: JSON.stringify(item.raw),
            matchStatus,
            propertyId,
            evidenceId,
          },
        });

        if (matchStatus === "review") {
          await prisma.matchReview.create({
            data: {
              workspaceId: live.id,
              ingestedRecordId: record.id,
              reason:
                match.status === "review"
                  ? match.reason
                  : "Company announcement stored without automatic property attachment.",
              candidatePropertyId:
                match.status === "review" ? match.candidatePropertyId : undefined,
              status: "pending",
            },
          });
        }
      }

      await recalculateWorkspaceOpportunities(live.id);
    } else {
      throw new Error(`Unsupported connector ${key}`);
    }

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

    return {
      ok: true,
      retrieved,
      created,
      duplicates,
      logs,
      workspaceId: live.id,
    };
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
        errorMessage: message,
        logJson: JSON.stringify(logs),
      },
    });
    await prisma.sourceConnector.update({
      where: { id: connector.id },
      data: { status: "error", lastError: message },
    });
    return { ok: false, error: message, retrieved, created, duplicates, logs };
  }
}

export async function runAllConnectors() {
  await ensureConnectors();
  const planning = await runConnector("planning_alerts_ws");
  const asx = await runConnector("asx_announcements");
  return { planning, asx };
}
