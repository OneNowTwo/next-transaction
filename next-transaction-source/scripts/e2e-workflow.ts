/**
 * End-to-end workflow: import → evidence → opportunities → rules/sources →
 * notes/status/review → feedback → export → persistence after reconnect.
 */
import { PrismaClient } from "@prisma/client";
import { addMonths } from "date-fns";
import { parsePropertyCsv } from "../src/lib/csv";
import { recalculateWorkspaceOpportunities } from "../src/lib/rules";

const prisma = new PrismaClient();

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(`E2E FAIL: ${msg}`);
}

async function main() {
  console.log("E2E workflow starting…");

  let real = await prisma.workspace.findFirst({ where: { mode: "real" } });
  assert(real, "real workspace must exist");
  const trial = await prisma.workspace.findFirst({ where: { mode: "trial" } });
  assert(trial, "public-source trial workspace must exist");
  assert(trial.name.toLowerCase().includes("public"), "trial workspace clearly labelled");

  const trialProps = await prisma.property.count({ where: { workspaceId: trial.id } });
  assert(trialProps === 3, `trial should have 3 properties, got ${trialProps}`);
  const trialEvidence = await prisma.evidence.findMany({
    where: { workspaceId: trial.id },
  });
  assert(trialEvidence.length >= 3, "trial needs evidence with sources");
  assert(
    trialEvidence.every((e) => e.sourceUrl && e.excerpt && e.eventDate),
    "trial evidence must include url, excerpt, event date"
  );
  assert(
    trialEvidence.every((e) => !e.isFictional),
    "trial evidence must not be marked fictional"
  );

  // Trial properties must keep unknown owner/tenant/lease unless stated
  const trialPropertyRows = await prisma.property.findMany({
    where: { workspaceId: trial.id },
  });
  for (const p of trialPropertyRows) {
    assert(p.ownerEntity === null, `${p.address}: owner must remain Unknown`);
    assert(p.tenant === null, `${p.address}: tenant must remain Unknown`);
    assert(p.leaseExpiry === null, `${p.address}: lease expiry must remain Unknown`);
  }

  // 1) CSV import validation + save into real workspace
  const csv = `address,suburb,propertyType,buildingAreaSqm,importKey
99 E2E Circuit,Erskine Park,Industrial,4500,e2e-99
`;
  const parsed = parsePropertyCsv(csv);
  assert(parsed.errors.length === 0, "valid CSV should parse");
  assert(parsed.rows.length === 1, "one row");

  const existing = await prisma.property.findUnique({
    where: {
      workspaceId_importKey: { workspaceId: real.id, importKey: "e2e-99" },
    },
  });
  if (existing) {
    await prisma.property.delete({ where: { id: existing.id } });
  }

  const property = await prisma.property.create({
    data: {
      workspaceId: real.id,
      address: "99 E2E Circuit",
      suburb: "Erskine Park",
      propertyType: "Industrial",
      buildingAreaSqm: 4500,
      importKey: "e2e-99",
      leaseExpiry: addMonths(new Date(), 4),
      ownerEntity: null,
      tenant: "E2E Tenant Co",
      isFictional: false,
    },
  });

  // Duplicate importKey handling
  let dupBlocked = false;
  try {
    await prisma.property.create({
      data: {
        workspaceId: real.id,
        address: "99 Dup",
        suburb: "Erskine Park",
        importKey: "e2e-99",
        isFictional: false,
      },
    });
  } catch {
    dupBlocked = true;
  }
  assert(dupBlocked, "duplicate importKey must be rejected by DB unique constraint");

  // 2) Evidence entry
  const evidence = await prisma.evidence.create({
    data: {
      workspaceId: real.id,
      propertyId: property.id,
      signalCategory: "lease_expiry",
      sourceTitle: "E2E lease diary",
      sourceUrl: "https://example.invalid/e2e-lease",
      excerpt: "Lease expires in approximately four months. Option status Unknown.",
      eventDate: new Date(),
      sourceType: "lease_record",
      verificationStatus: "verified",
      eventKey: `e2e-lease-${property.id}`,
      isFictional: false,
    },
  });

  // Duplicate event key
  let evidDup = false;
  const again = await prisma.evidence.findFirst({
    where: { workspaceId: real.id, eventKey: evidence.eventKey! },
  });
  if (again) evidDup = true;
  assert(evidDup, "event key lookup works for duplicate detection");

  // 3) Opportunity generation
  const beforeCount = await recalculateWorkspaceOpportunities(real.id);
  assert(beforeCount >= 1, "recalculate should create opportunities");
  let opp = await prisma.opportunity.findFirst({
    where: { propertyId: property.id, type: "leasing" },
    include: {
      rules: { include: { rule: true } },
      evidence: { include: { evidence: true } },
    },
  });
  assert(opp, "leasing opportunity expected");
  assert(opp.rules.length >= 1, "rules that fired must be visible");
  assert(opp.evidence.some((l) => l.evidenceId === evidence.id), "evidence linked");
  assert(opp.whyNow.toLowerCase().includes("what changed"), "plain-English why-now");

  // 4) Notes, status, review date
  await prisma.note.create({
    data: {
      workspaceId: real.id,
      opportunityId: opp.id,
      propertyId: property.id,
      body: "E2E note: called tenant receptionist; waiting on facilities manager.",
    },
  });
  await prisma.opportunity.update({
    where: { id: opp.id },
    data: {
      status: "investigating",
      reviewDate: addMonths(new Date(), 1),
    },
  });

  // 5) Feedback
  await prisma.feedback.upsert({
    where: {
      workspaceId_opportunityId: {
        workspaceId: real.id,
        opportunityId: opp.id,
      },
    },
    create: {
      workspaceId: real.id,
      opportunityId: opp.id,
      labels: JSON.stringify(["useful", "new_to_me"]),
    },
    update: { labels: JSON.stringify(["useful", "new_to_me"]) },
  });

  // Recalculate must preserve workflow
  await recalculateWorkspaceOpportunities(real.id);
  opp = await prisma.opportunity.findFirst({
    where: { propertyId: property.id, type: "leasing" },
    include: { notes: true, feedback: true, rules: true, evidence: true },
  });
  assert(opp?.status === "investigating", "status persists across recalculation");
  assert(opp?.reviewDate, "review date persists");
  assert((opp?.notes.length ?? 0) >= 1, "notes re-linked");
  assert(opp?.feedback, "feedback re-linked");

  // 6) Export payload shape
  const exportBundle = {
    properties: await prisma.property.findMany({ where: { workspaceId: real.id } }),
    evidence: await prisma.evidence.findMany({ where: { workspaceId: real.id } }),
    notes: await prisma.note.findMany({ where: { workspaceId: real.id } }),
    feedback: await prisma.feedback.findMany({ where: { workspaceId: real.id } }),
    opportunities: await prisma.opportunity.findMany({ where: { workspaceId: real.id } }),
  };
  assert(exportBundle.properties.length >= 1, "export has properties");
  assert(exportBundle.evidence.length >= 1, "export has evidence");
  assert(exportBundle.opportunities.length >= 1, "export has opportunities");

  // 7) Persistence after disconnect/reconnect (simulates app restart)
  const oppId = opp!.id;
  const noteBody = opp!.notes[0].body;
  await prisma.$disconnect();

  const prisma2 = new PrismaClient();
  const afterRestart = await prisma2.opportunity.findUnique({
    where: { id: oppId },
    include: { notes: true, feedback: true, property: true },
  });
  assert(afterRestart, "opportunity survives reconnect");
  assert(afterRestart.status === "investigating", "status after restart");
  assert(
    afterRestart.notes.some((n) => n.body === noteBody),
    "notes after restart"
  );
  assert(afterRestart.feedback, "feedback after restart");
  assert(afterRestart.property.address === "99 E2E Circuit", "property after restart");

  // Cleanup e2e property from real workspace
  await prisma2.property.delete({ where: { id: property.id } });
  await recalculateWorkspaceOpportunities(real.id);
  await prisma2.$disconnect();

  console.log("E2E workflow passed.");
}

main().catch(async (err) => {
  console.error(err);
  await prisma.$disconnect().catch(() => undefined);
  process.exit(1);
});
