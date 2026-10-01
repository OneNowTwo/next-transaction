import { PrismaClient } from "@prisma/client";
import { addMonths, subDays, subYears } from "date-fns";
import { DEFAULT_RULES, recalculateWorkspaceOpportunities } from "../src/lib/rules";

const prisma = new PrismaClient();

async function seedRules(workspaceId: string) {
  for (const rule of DEFAULT_RULES) {
    await prisma.rule.upsert({
      where: { workspaceId_key: { workspaceId, key: rule.key } },
      create: { workspaceId, ...rule, enabled: true },
      update: {
        name: rule.name,
        description: rule.description,
        opportunityType: rule.opportunityType,
        weight: rule.weight,
        configJson: rule.configJson,
      },
    });
  }
}

async function seedDemo() {
  const existing = await prisma.workspace.findFirst({ where: { mode: "demo" } });
  if (existing) {
    await prisma.workspace.delete({ where: { id: existing.id } });
  }

  const demo = await prisma.workspace.create({
    data: {
      name: "Western Sydney Demo",
      mode: "demo",
      isFictional: true,
    },
  });

  let real = await prisma.workspace.findFirst({ where: { mode: "real" } });
  if (!real) {
    real = await prisma.workspace.create({
      data: {
        name: "My Workspace",
        mode: "real",
        isFictional: false,
      },
    });
  }

  await seedRules(demo.id);
  await seedRules(real.id);

  const now = new Date();

  type PropSeed = {
    key: string;
    address: string;
    suburb: string;
    landAreaSqm?: number;
    buildingAreaSqm?: number;
    ownerEntity?: string;
    tenant?: string;
    lastSaleDate?: Date;
    leaseExpiry?: Date;
    leaseOptionInfo?: string;
    leaseVerifiedAt?: Date;
    assignedAgent?: string;
    relationshipNotes?: string;
  };

  const props: PropSeed[] = [
    {
      key: "p01",
      address: "12 Distribution Drive",
      suburb: "Eastern Creek",
      landAreaSqm: 12000,
      buildingAreaSqm: 8500,
      ownerEntity: "Creekhold Industrial Pty Ltd",
      tenant: "SwiftPack Logistics",
      lastSaleDate: subYears(now, 3),
      leaseExpiry: addMonths(now, 5),
      leaseOptionInfo: "1 x 5 year option; exercise status Unknown",
      leaseVerifiedAt: subDays(now, 40),
      assignedAgent: "Sam Rivera",
      relationshipNotes: "Met owner at PCA lunch 2024.",
    },
    {
      key: "p02",
      address: "88 Warehouse Road",
      suburb: "Wetherill Park",
      landAreaSqm: 9000,
      buildingAreaSqm: 6200,
      ownerEntity: "Parkline Assets Trust",
      tenant: "Northline Fulfillment",
      lastSaleDate: subYears(now, 12),
      leaseExpiry: addMonths(now, 18),
      leaseOptionInfo: "No option remaining",
      assignedAgent: "Sam Rivera",
    },
    {
      key: "p03",
      address: "5 Freight Circuit",
      suburb: "Erskine Park",
      landAreaSqm: 15000,
      buildingAreaSqm: 11000,
      ownerEntity: "BlueSpan Property Group",
      tenant: "Apex Coldstore",
      lastSaleDate: subYears(now, 2),
      leaseExpiry: addMonths(now, 28),
      leaseOptionInfo: "Option exercised to 2031 (verify)",
      leaseVerifiedAt: subDays(now, 200),
    },
    {
      key: "p04",
      address: "41 Industrial Avenue",
      suburb: "Smithfield",
      landAreaSqm: 4500,
      buildingAreaSqm: 3200,
      ownerEntity: "Smithfield Holdings Co",
      tenant: "MetroParts Supply",
      lastSaleDate: subYears(now, 15),
      leaseExpiry: addMonths(now, 3),
    },
    {
      key: "p05",
      address: "19 Logistics Boulevard",
      suburb: "Horsley Park",
      landAreaSqm: 20000,
      buildingAreaSqm: 14000,
      ownerEntity: "Horizon REIT Nominee",
      tenant: "BulkHaul Australia",
      lastSaleDate: subYears(now, 6),
      leaseExpiry: addMonths(now, 20),
      assignedAgent: "Jordan Lee",
    },
    {
      key: "p06",
      address: "77 Trade Way",
      suburb: "Minchinbury",
      landAreaSqm: 7000,
      buildingAreaSqm: 4800,
      ownerEntity: "Minchin Capital Pty Ltd",
      tenant: "ClearSpan Packaging",
      lastSaleDate: subYears(now, 11),
      leaseExpiry: addMonths(now, 14),
    },
    {
      key: "p07",
      address: "3 Rail Siding Place",
      suburb: "St Marys",
      landAreaSqm: 11000,
      buildingAreaSqm: 7600,
      ownerEntity: "Siding Investments",
      tenant: "Unknown",
      lastSaleDate: subYears(now, 9),
    },
    {
      key: "p08",
      address: "250 Great Western Highway",
      suburb: "Arndell Park",
      landAreaSqm: 8000,
      buildingAreaSqm: 5500,
      ownerEntity: "Arndell Freehold Pty Ltd",
      tenant: "QuickPick Retail DC",
      lastSaleDate: subYears(now, 4),
      leaseExpiry: addMonths(now, 22),
      leaseOptionInfo: "1 x 3 year option unexercised",
    },
    {
      key: "p09",
      address: "14 Cranebrook Road",
      suburb: "Penrith",
      landAreaSqm: 6000,
      buildingAreaSqm: 4100,
      ownerEntity: "Nepean Industrial Partners",
      tenant: "ForgeTech Components",
      lastSaleDate: subYears(now, 14),
      leaseExpiry: addMonths(now, 26),
      assignedAgent: "Jordan Lee",
      relationshipNotes: "Owner open to valuation discussion.",
    },
    {
      key: "p10",
      address: "60 Wonderland Drive",
      suburb: "Eastern Creek",
      landAreaSqm: 18000,
      buildingAreaSqm: 12500,
      ownerEntity: "ThemePark Land Co",
      tenant: "National Tyre Distributors",
      lastSaleDate: subYears(now, 7),
      leaseExpiry: addMonths(now, 30),
    },
    {
      key: "p11",
      address: "9 Interchange Place",
      suburb: "Prestons",
      landAreaSqm: 10000,
      buildingAreaSqm: 7000,
      ownerEntity: "SouthWest Logistics Trust",
      tenant: "ParcelLink Express",
      lastSaleDate: subYears(now, 5),
      leaseExpiry: addMonths(now, 6),
      leaseVerifiedAt: subDays(now, 15),
    },
    {
      key: "p12",
      address: "33 Holbeche Road",
      suburb: "Arndell Park",
      landAreaSqm: 5200,
      buildingAreaSqm: 3600,
      ownerEntity: "Holbeche Nominees",
      tenant: "AquaFlow Valves",
      lastSaleDate: subYears(now, 16),
    },
    {
      key: "p13",
      address: "101 Reconciliation Road",
      suburb: "Pemulwuy",
      landAreaSqm: 14000,
      buildingAreaSqm: 9800,
      ownerEntity: "Pemulwuy Estates",
      tenant: "GreenBox Fulfilment",
      lastSaleDate: subYears(now, 1),
      leaseExpiry: addMonths(now, 40),
    },
    {
      key: "p14",
      address: "8 Davies Road",
      suburb: "Padstow",
      landAreaSqm: 4800,
      buildingAreaSqm: 3000,
      ownerEntity: "Davies Family Trust",
      tenant: "Coastal Timber Supplies",
      lastSaleDate: subYears(now, 13),
      leaseExpiry: addMonths(now, 20),
    },
    {
      key: "p15",
      address: "22 Cosgrove Road",
      suburb: "Enfield",
      landAreaSqm: 9500,
      buildingAreaSqm: 8000,
      ownerEntity: "InnerWest Industrial Fund",
      tenant: "Metro Cold Chain",
      lastSaleDate: subYears(now, 8),
      leaseExpiry: addMonths(now, 4),
      leaseOptionInfo: "Option window opens in 60 days",
    },
    {
      key: "p16",
      address: "17 Munday Street",
      suburb: "St Marys",
      landAreaSqm: 3500,
      buildingAreaSqm: 2400,
      ownerEntity: "Munday Street Holdings",
      tenant: "LocalFit Gym Equipment",
      lastSaleDate: subYears(now, 10),
      leaseExpiry: addMonths(now, 16),
    },
    {
      key: "p17",
      address: "45 Lucca Road",
      suburb: "Wyong",
      landAreaSqm: 16000,
      buildingAreaSqm: 10500,
      ownerEntity: "Central Coast Freehold",
      tenant: "Shoreline Packaging",
      lastSaleDate: subYears(now, 18),
      leaseExpiry: addMonths(now, 19),
    },
    {
      key: "p18",
      address: "2 Old Wallgrove Road",
      suburb: "Eastern Creek",
      landAreaSqm: 22000,
      buildingAreaSqm: 16000,
      ownerEntity: "Wallgrove Partners",
      tenant: "MegaSort Automation",
      lastSaleDate: subYears(now, 2),
      leaseExpiry: addMonths(now, 24),
      assignedAgent: "Sam Rivera",
    },
    {
      key: "p19",
      address: "70 Tattersall Road",
      suburb: "Kings Park",
      landAreaSqm: 7200,
      buildingAreaSqm: 5000,
      ownerEntity: "Kings Park Capital",
      tenant: "AlloyWorks Fabrication",
      lastSaleDate: subYears(now, 11),
      leaseExpiry: addMonths(now, 1),
      leaseVerifiedAt: subDays(now, 10),
    },
    {
      key: "p20",
      address: "15 Forrester Road",
      suburb: "St Marys",
      landAreaSqm: 13000,
      buildingAreaSqm: 9000,
      ownerEntity: "Forrester Industrial Trust",
      tenant: "RiverCity Distributors",
      lastSaleDate: subYears(now, 6),
      leaseExpiry: addMonths(now, 15),
      relationshipNotes: "Warm intro via mutual accountant.",
    },
  ];

  const propertyIds: Record<string, string> = {};
  for (const p of props) {
    const created = await prisma.property.create({
      data: {
        workspaceId: demo.id,
        address: p.address,
        suburb: p.suburb,
        propertyType: "Industrial",
        landAreaSqm: p.landAreaSqm,
        buildingAreaSqm: p.buildingAreaSqm,
        ownerEntity: p.ownerEntity === "Unknown" ? null : p.ownerEntity,
        tenant: p.tenant === "Unknown" ? null : p.tenant,
        lastSaleDate: p.lastSaleDate,
        leaseExpiry: p.leaseExpiry,
        leaseOptionInfo: p.leaseOptionInfo,
        leaseVerifiedAt: p.leaseVerifiedAt,
        assignedAgent: p.assignedAgent,
        relationshipNotes: p.relationshipNotes,
        isFictional: true,
        importKey: p.key,
      },
    });
    propertyIds[p.key] = created.id;
  }

  type EvSeed = {
    propertyKey: string;
    signalCategory: string;
    sourceTitle: string;
    sourceUrl?: string;
    excerpt: string;
    eventDate?: Date;
    collectedAt?: Date;
    sourceType: string;
    verificationStatus: string;
    eventKey?: string;
    isStale?: boolean;
  };

  const evidenceSeed: EvSeed[] = [
    // Strong leasing: expiry + consolidation (p01)
    {
      propertyKey: "p01",
      signalCategory: "lease_expiry",
      sourceTitle: "Lease abstract — 12 Distribution Drive",
      excerpt: "Current lease expires in five months. Option remains unexercised.",
      eventDate: subDays(now, 40),
      sourceType: "lease_record",
      verificationStatus: "verified",
      eventKey: "p01-lease-expiry",
    },
    {
      propertyKey: "p01",
      signalCategory: "consolidation",
      sourceTitle: "SwiftPack logistics network update",
      sourceUrl: "https://example.invalid/swiftpack-network",
      excerpt: "SwiftPack announced consolidation of NSW fulfillment into two hubs.",
      eventDate: subDays(now, 20),
      sourceType: "company_announcement",
      verificationStatus: "verified",
      eventKey: "p01-consolidation",
    },
    // Weak: long ownership only (p12)
    {
      propertyKey: "p12",
      signalCategory: "long_ownership",
      sourceTitle: "Title tenure note",
      excerpt: "Same owner entity on title for 16+ years. No disposal signal.",
      eventDate: subDays(now, 5),
      sourceType: "other",
      verificationStatus: "unverified",
      eventKey: "p12-long-own",
    },
    // Conflicting expansion vs contraction (p05)
    {
      propertyKey: "p05",
      signalCategory: "tenant_expansion",
      sourceTitle: "BulkHaul fleet growth interview",
      sourceUrl: "https://example.invalid/bulkhaul-growth",
      excerpt: "CEO said Western Sydney volume will grow 30% next year.",
      eventDate: subDays(now, 25),
      sourceType: "news",
      verificationStatus: "unverified",
      eventKey: "p05-expand",
    },
    {
      propertyKey: "p05",
      signalCategory: "tenant_contraction",
      sourceTitle: "Industry chatter — BulkHaul",
      excerpt: "Broker note claims BulkHaul is exiting one Western Sydney site.",
      eventDate: subDays(now, 12),
      sourceType: "agent_note",
      verificationStatus: "disputed",
      eventKey: "p05-contract",
    },
    // Missing info heavy (p07) — planning only, no tenant/lease
    {
      propertyKey: "p07",
      signalCategory: "planning_activity",
      sourceTitle: "Blacktown DA tracker excerpt",
      sourceUrl: "https://example.invalid/da-erskine",
      excerpt: "DA lodged for warehouse extension on neighbouring lot; may affect access.",
      eventDate: subDays(now, 18),
      sourceType: "planning",
      verificationStatus: "verified",
      eventKey: "p07-planning",
    },
    // Owner disposal strong (p09)
    {
      propertyKey: "p09",
      signalCategory: "owner_disposal",
      sourceTitle: "ASIC notice — Nepean Industrial Partners",
      sourceUrl: "https://example.invalid/asic-nepean",
      excerpt: "Entity lodged notice indicating review of non-core industrial assets.",
      eventDate: subDays(now, 30),
      sourceType: "asic",
      verificationStatus: "verified",
      eventKey: "p09-disposal",
    },
    {
      propertyKey: "p09",
      signalCategory: "owner_conversation",
      sourceTitle: "Call note with asset manager",
      excerpt: "Asset manager asked for a soft sounding on 14 Cranebrook Road.",
      eventDate: subDays(now, 8),
      sourceType: "owner_conversation",
      verificationStatus: "verified",
      eventKey: "p09-call",
    },
    {
      propertyKey: "p09",
      signalCategory: "appraisal",
      sourceTitle: "Prior appraisal file",
      excerpt: "Desktop appraisal prepared 11 months ago for internal board pack.",
      eventDate: subDays(now, 330),
      sourceType: "agent_note",
      verificationStatus: "verified",
      eventKey: "p09-appraisal",
    },
    // Approaching expiry (p04) medium
    {
      propertyKey: "p04",
      signalCategory: "lease_expiry",
      sourceTitle: "CRM lease diary",
      excerpt: "Lease expires in ~3 months. Option info Unknown.",
      eventDate: subDays(now, 3),
      sourceType: "lease_record",
      verificationStatus: "unverified",
      eventKey: "p04-lease",
    },
    // Relocation (p11)
    {
      propertyKey: "p11",
      signalCategory: "relocation",
      sourceTitle: "ParcelLink site search brief",
      sourceUrl: "https://example.invalid/parcellink-brief",
      excerpt: "Tenant advisors circulating a 7,000–9,000 sqm requirement near M7.",
      eventDate: subDays(now, 14),
      sourceType: "news",
      verificationStatus: "verified",
      eventKey: "p11-reloc",
    },
    {
      propertyKey: "p11",
      signalCategory: "lease_expiry",
      sourceTitle: "Lease summary",
      excerpt: "Lease ends in six months.",
      eventDate: subDays(now, 15),
      sourceType: "lease_record",
      verificationStatus: "verified",
      eventKey: "p11-lease",
    },
    // Portfolio activity (p02)
    {
      propertyKey: "p02",
      signalCategory: "portfolio_activity",
      sourceTitle: "Parkline Assets strategy note",
      excerpt: "Trust flagged Wetherill Park assets for potential recycling this FY.",
      eventDate: subDays(now, 45),
      sourceType: "company_announcement",
      verificationStatus: "unverified",
      eventKey: "p02-portfolio",
    },
    // Duplicate same event — should dedupe (p15)
    {
      propertyKey: "p15",
      signalCategory: "lease_expiry",
      sourceTitle: "Lease diary export",
      excerpt: "Option window opens in 60 days; lease expiry in four months.",
      eventDate: subDays(now, 7),
      sourceType: "lease_record",
      verificationStatus: "verified",
      eventKey: "p15-lease-window",
    },
    {
      propertyKey: "p15",
      signalCategory: "lease_expiry",
      sourceTitle: "Same lease diary re-imported",
      excerpt: "Duplicate of lease diary export for Cosgrove Road.",
      eventDate: subDays(now, 7),
      sourceType: "lease_record",
      verificationStatus: "verified",
      eventKey: "p15-lease-window",
    },
    // Stale evidence (p06)
    {
      propertyKey: "p06",
      signalCategory: "owner_conversation",
      sourceTitle: "Old coffee catch-up note",
      excerpt: "Owner mentioned curiosity about values two years ago.",
      eventDate: subDays(now, 700),
      sourceType: "owner_conversation",
      verificationStatus: "stale",
      isStale: true,
      eventKey: "p06-old-chat",
    },
    {
      propertyKey: "p06",
      signalCategory: "long_ownership",
      sourceTitle: "Ownership tenure",
      excerpt: "Owned ~11 years.",
      eventDate: subDays(now, 2),
      sourceType: "other",
      verificationStatus: "unverified",
      eventKey: "p06-long",
    },
    // Conflicting owner disposal vs "not selling" (p17)
    {
      propertyKey: "p17",
      signalCategory: "owner_disposal",
      sourceTitle: "Rumour — Central Coast Freehold",
      excerpt: "Market rumour of potential disposal of Lucca Road.",
      eventDate: subDays(now, 21),
      sourceType: "news",
      verificationStatus: "unverified",
      eventKey: "p17-rumour",
    },
    {
      propertyKey: "p17",
      signalCategory: "owner_conversation",
      sourceTitle: "Direct owner reply",
      excerpt: "Owner said they are not selling Lucca Road this year.",
      eventDate: subDays(now, 10),
      sourceType: "owner_conversation",
      verificationStatus: "verified",
      eventKey: "p17-not-selling",
    },
    // Imminent expiry strong (p19)
    {
      propertyKey: "p19",
      signalCategory: "lease_expiry",
      sourceTitle: "Verified lease abstract",
      excerpt: "Lease expires in approximately one month. No remaining options.",
      eventDate: subDays(now, 10),
      sourceType: "lease_record",
      verificationStatus: "verified",
      eventKey: "p19-lease",
    },
    {
      propertyKey: "p19",
      signalCategory: "tenant_contraction",
      sourceTitle: "AlloyWorks production update",
      sourceUrl: "https://example.invalid/alloyworks",
      excerpt: "AlloyWorks reducing fabrication shifts at Kings Park.",
      eventDate: subDays(now, 9),
      sourceType: "company_announcement",
      verificationStatus: "verified",
      eventKey: "p19-contract",
    },
    // Planning + long ownership weak sale (p14)
    {
      propertyKey: "p14",
      signalCategory: "planning_activity",
      sourceTitle: "Canterbury-Bankstown DA list",
      excerpt: "Minor alteration DA nearby; limited direct impact.",
      eventDate: subDays(now, 60),
      sourceType: "planning",
      verificationStatus: "unverified",
      eventKey: "p14-planning",
    },
  ];

  for (const e of evidenceSeed) {
    await prisma.evidence.create({
      data: {
        workspaceId: demo.id,
        propertyId: propertyIds[e.propertyKey],
        signalCategory: e.signalCategory,
        sourceTitle: e.sourceTitle,
        sourceUrl: e.sourceUrl,
        excerpt: e.excerpt,
        eventDate: e.eventDate,
        collectedAt: e.collectedAt ?? e.eventDate ?? now,
        sourceType: e.sourceType,
        verificationStatus: e.verificationStatus,
        eventKey: e.eventKey,
        isFictional: true,
        isStale: e.isStale ?? false,
      },
    });
  }

  const count = await recalculateWorkspaceOpportunities(demo.id);
  console.log(`Seeded demo workspace ${demo.id} with ${props.length} properties and ${count} opportunities.`);
  console.log(`Real workspace ready: ${real.id}`);

  await seedPublicSourceTrial();
}

/**
 * Public-source trial: three Western Sydney industrial addresses with
 * publicly dated web sources. Separate from fictional demo and personal/agency data.
 * Owner/tenant/lease left Unknown unless the public page states them.
 * Public listings are not framed as pre-market discoveries.
 */
async function seedPublicSourceTrial() {
  const existing = await prisma.workspace.findFirst({ where: { mode: "trial" } });
  if (existing) {
    await prisma.workspace.delete({ where: { id: existing.id } });
  }

  const trial = await prisma.workspace.create({
    data: {
      name: "Public-source trial",
      mode: "trial",
      isFictional: false,
    },
  });
  await seedRules(trial.id);

  const collectedAt = new Date();

  const shale = await prisma.property.create({
    data: {
      workspaceId: trial.id,
      address: "2 Shale Place",
      suburb: "Eastern Creek",
      propertyType: "Industrial",
      buildingAreaSqm: 3288,
      landAreaSqm: 5686,
      ownerEntity: null,
      tenant: null,
      lastSaleDate: null,
      leaseExpiry: null,
      leaseOptionInfo: null,
      isFictional: false,
      importKey: "trial-shale",
      relationshipNotes:
        "Public-source trial record. Owner/tenant/lease Unknown — listing does not publish them.",
    },
  });

  await prisma.evidence.create({
    data: {
      workspaceId: trial.id,
      propertyId: shale.id,
      signalCategory: "public_listing",
      sourceTitle:
        "Commercial Real Estate — 2 Shale Place, Eastern Creek (for lease listing)",
      sourceUrl:
        "https://www.commercialrealestate.com.au/property/2-shale-place-eastern-creek-nsw-2766-18090329",
      excerpt:
        "For Lease industrial facility at 2 Shale Place, Eastern Creek NSW 2766. Floor area 3,288 m²; land area 5,686 m²; whole building. Listing last updated 2 Sep 2026. Presented by Cushman & Wakefield Parramatta. This is an open-market public advertisement, not a pre-market discovery.",
      eventDate: new Date("2026-09-02"),
      collectedAt,
      sourceType: "public_listing",
      verificationStatus: "verified",
      eventKey: "trial-shale-cre-18090329",
      isFictional: false,
    },
  });

  const kangaroo = await prisma.property.create({
    data: {
      workspaceId: trial.id,
      address: "4 Kangaroo Avenue",
      suburb: "Eastern Creek",
      propertyType: "Industrial",
      buildingAreaSqm: 15899,
      ownerEntity: null,
      tenant: null,
      lastSaleDate: null,
      leaseExpiry: null,
      isFictional: false,
      importKey: "trial-kangaroo",
      relationshipNotes:
        "Public-source trial record. Listing reported as leased — market context only.",
    },
  });

  await prisma.evidence.create({
    data: {
      workspaceId: trial.id,
      propertyId: kangaroo.id,
      signalCategory: "public_listing",
      sourceTitle:
        "Commercial Real Estate — 4 Kangaroo Avenue, Eastern Creek (leased listing page)",
      sourceUrl:
        "https://www.commercialrealestate.com.au/property/4-kangaroo-avenue-eastern-creek-nsw-2766-17711299",
      excerpt:
        "Page reports 4 Kangaroo Avenue, Eastern Creek NSW 2766 as Leased on 13 Aug 2026. Floor area 15,899 m². Factory, Warehouse & Industrial. Last updated 12 Aug 2026. JLL Parramatta associated with the campaign. Useful as market context — not an open vacancy lead.",
      eventDate: new Date("2026-08-13"),
      collectedAt,
      sourceType: "public_listing",
      verificationStatus: "verified",
      eventKey: "trial-kangaroo-cre-17711299",
      isFictional: false,
    },
  });

  const battalion = await prisma.property.create({
    data: {
      workspaceId: trial.id,
      address: "20 Battalion Glade",
      suburb: "Eastern Creek",
      propertyType: "Industrial",
      ownerEntity: null,
      tenant: null,
      lastSaleDate: null,
      leaseExpiry: null,
      isFictional: false,
      importKey: "trial-battalion",
      relationshipNotes:
        "Public-source trial record from Planning Alerts / Blacktown City Council reference. Owner and tenant Unknown.",
    },
  });

  await prisma.evidence.create({
    data: {
      workspaceId: trial.id,
      propertyId: battalion.id,
      signalCategory: "planning_activity",
      sourceTitle:
        "Planning Alerts — 20 Battalion Glade Eastern Creek (CC-25-00474)",
      sourceUrl: "https://www.planningalerts.org.au/applications/3298269",
      excerpt:
        "Blacktown City Council reference CC-25-00474. Description: Construction and Operation of Warehouse and distribution centre for handling chilled, frozen and fresh food products, including ancillary office and amenities, carparking and landscaping. Planning Alerts sourced the application on 25 May 2025 (reported as received by council 4 days earlier). Planning notice alone does not prove a sale or leasing instruction.",
      eventDate: new Date("2025-05-25"),
      collectedAt,
      sourceType: "planning",
      verificationStatus: "verified",
      eventKey: "trial-battalion-cc-25-00474",
      isFictional: false,
    },
  });

  const oppCount = await recalculateWorkspaceOpportunities(trial.id);
  console.log(
    `Seeded public-source trial ${trial.id} with 3 properties and ${oppCount} research cards.`
  );
}

seedDemo()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
