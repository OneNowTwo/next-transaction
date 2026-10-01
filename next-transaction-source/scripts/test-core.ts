/**
 * Core behaviour checks: CSV validation, duplicate evidence handling,
 * scoring rules (incl. long-ownership cap), evidence references, persistence.
 */
import { PrismaClient } from "@prisma/client";
import { addMonths, subYears } from "date-fns";
import { parsePropertyCsv } from "../src/lib/csv";
import {
  DEFAULT_RULES,
  generateOpportunitiesForProperty,
  recalculateWorkspaceOpportunities,
} from "../src/lib/rules";

const prisma = new PrismaClient();

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`FAIL: ${message}`);
}

async function main() {
  console.log("Running core tests…");

  // 1) CSV validation
  const bad = parsePropertyCsv("suburb\nOnlySuburb\n");
  assert(
    bad.errors.some((e) => e.messages.some((m) => m.includes("address"))),
    "CSV should require address column"
  );

  const good = parsePropertyCsv(
    "address,suburb,importKey\n1 Test Rd,Eastern Creek,t-1\n1 Test Rd,Eastern Creek,t-1\n"
  );
  assert(
    good.errors.some((e) => e.messages.some((m) => m.includes("Duplicate importKey"))),
    "CSV should reject duplicate importKey in file"
  );

  const valid = parsePropertyCsv(
    "address,suburb,landAreaSqm,importKey\n9 Demo Ave,Wetherill Park,abc,ok-1\n"
  );
  assert(
    valid.errors.some((e) => e.messages.some((m) => m.toLowerCase().includes("number"))),
    "CSV should reject non-numeric landAreaSqm"
  );

  // 2) Rules: long ownership alone is low priority
  const now = new Date();
  const fakeProperty = {
    id: "p",
    workspaceId: "w",
    address: "1 Long Own St",
    suburb: "Smithfield",
    propertyType: "Industrial",
    landAreaSqm: null,
    buildingAreaSqm: null,
    ownerEntity: "Owner",
    tenant: null,
    lastSaleDate: subYears(now, 16),
    leaseExpiry: null,
    leaseOptionInfo: null,
    leaseVerifiedAt: null,
    assignedAgent: null,
    relationshipNotes: null,
    isFictional: true,
    importKey: null,
    createdAt: now,
    updatedAt: now,
  };
  const rules = DEFAULT_RULES.map((r, i) => ({
    id: `r${i}`,
    workspaceId: "w",
    enabled: true,
    createdAt: now,
    updatedAt: now,
    ...r,
  }));
  const longOnly = generateOpportunitiesForProperty(fakeProperty, [], rules, now);
  assert(
    !longOnly.some((o) => o.type === "sale"),
    "long ownership alone must not create a sale opportunity"
  );

  // 3) Strong leasing evidence ranks higher
  const leaseProp = {
    ...fakeProperty,
    id: "p2",
    lastSaleDate: subYears(now, 2),
    leaseExpiry: addMonths(now, 4),
    tenant: "Tenant Co",
    ownerEntity: "Owner Co",
    leaseOptionInfo: "1x5 unknown",
    leaseVerifiedAt: now,
  };
  const evidence = [
    {
      id: "e1",
      workspaceId: "w",
      propertyId: "p2",
      signalCategory: "lease_expiry",
      sourceTitle: "Lease",
      sourceUrl: "https://example.invalid/lease",
      excerpt: "Expires soon",
      eventDate: now,
      collectedAt: now,
      sourceType: "lease_record",
      verificationStatus: "verified",
      eventKey: "same-event",
      isFictional: true,
      isStale: false,
      isResolved: false,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: "e2",
      workspaceId: "w",
      propertyId: "p2",
      signalCategory: "consolidation",
      sourceTitle: "Announcement",
      sourceUrl: null,
      excerpt: "Consolidating NSW",
      eventDate: now,
      collectedAt: now,
      sourceType: "company_announcement",
      verificationStatus: "verified",
      eventKey: "consol",
      isFictional: true,
      isStale: false,
      isResolved: false,
      createdAt: now,
      updatedAt: now,
    },
    // duplicate same event key — must not double-count
    {
      id: "e3",
      workspaceId: "w",
      propertyId: "p2",
      signalCategory: "lease_expiry",
      sourceTitle: "Lease copy",
      sourceUrl: null,
      excerpt: "Duplicate",
      eventDate: now,
      collectedAt: now,
      sourceType: "lease_record",
      verificationStatus: "verified",
      eventKey: "same-event",
      isFictional: true,
      isStale: false,
      isResolved: false,
      createdAt: now,
      updatedAt: now,
    },
  ];
  const leasing = generateOpportunitiesForProperty(leaseProp, evidence, rules, now);
  const leaseOpp = leasing.find((o) => o.type === "leasing");
  assert(leaseOpp, "lease + consolidation should create leasing opportunity");
  assert(
    leaseOpp.evidenceIds.includes("e1") && !leaseOpp.evidenceIds.includes("e3"),
    "duplicate event keys must not both attach as independent evidence"
  );
  assert(
    leaseOpp.ruleHits.some((h) => h.explanation.length > 0),
    "opportunity must expose which rules fired"
  );
  assert(
    leaseOpp.priority === "high" || leaseOpp.priority === "medium",
    "strong recent verified evidence should not be low"
  );

  // 4) Persistence / recalculate against real DB
  const workspace =
    (await prisma.workspace.findFirst({ where: { mode: "demo" } })) ??
    (await prisma.workspace.create({
      data: { name: "Test Demo", mode: "demo", isFictional: true },
    }));

  for (const rule of DEFAULT_RULES) {
    await prisma.rule.upsert({
      where: { workspaceId_key: { workspaceId: workspace.id, key: rule.key } },
      create: { workspaceId: workspace.id, ...rule, enabled: true },
      update: {},
    });
  }

  const prop = await prisma.property.create({
    data: {
      workspaceId: workspace.id,
      address: `Persist Test ${Date.now()}`,
      suburb: "Eastern Creek",
      isFictional: true,
      leaseExpiry: addMonths(now, 3),
      ownerEntity: "Persist Owner",
      tenant: "Persist Tenant",
    },
  });

  await prisma.evidence.create({
    data: {
      workspaceId: workspace.id,
      propertyId: prop.id,
      signalCategory: "lease_expiry",
      sourceTitle: "Persist lease",
      excerpt: "Lease nearing end",
      eventDate: now,
      sourceType: "lease_record",
      verificationStatus: "verified",
      eventKey: `persist-${prop.id}`,
      isFictional: true,
    },
  });

  const before = await recalculateWorkspaceOpportunities(workspace.id);
  assert(before > 0, "recalculate should create opportunities");

  const found = await prisma.opportunity.findFirst({
    where: { propertyId: prop.id, type: "leasing" },
    include: { evidence: true, rules: true },
  });
  assert(found, "persisted leasing opportunity expected");
  assert(found.evidence.length >= 1, "opportunity should reference evidence");
  assert(found.rules.length >= 1, "opportunity should reference fired rules");

  await prisma.opportunity.update({
    where: { id: found.id },
    data: { status: "investigating" },
  });
  await recalculateWorkspaceOpportunities(workspace.id);
  const after = await prisma.opportunity.findFirst({
    where: { propertyId: prop.id, type: "leasing" },
  });
  assert(after?.status === "investigating", "workflow status should survive recalculation");

  // Cleanup test property
  await prisma.property.delete({ where: { id: prop.id } });
  await recalculateWorkspaceOpportunities(workspace.id);

  console.log("All core tests passed.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
