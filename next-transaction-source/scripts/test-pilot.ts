import { PrismaClient } from "@prisma/client";
import { parseAustralianAddress } from "../src/lib/geo";
import { runConnector } from "../src/lib/ingestion/pipeline";

const prisma = new PrismaClient();

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(`PILOT FAIL: ${msg}`);
}

async function main() {
  const parsed = parseAustralianAddress("4 Kangaroo Avenue Eastern Creek NSW 2766");
  assert(parsed.address === "4 Kangaroo Avenue", "address parse street");
  assert(parsed.suburb === "Eastern Creek", "address parse suburb");

  const live = await prisma.workspace.findFirst({ where: { mode: "live" } });
  const demo = await prisma.workspace.findFirst({ where: { mode: "demo" } });
  assert(live && demo, "live and demo workspaces exist");
  assert(live.id !== demo.id, "workspaces separated");

  const liveFictional = await prisma.opportunity.count({
    where: { workspaceId: live.id, isFictional: true },
  });
  assert(liveFictional === 0, "live feed must not contain fictional opportunities");

  const records = await prisma.ingestedRecord.count({ where: { workspaceId: live.id } });
  assert(records >= 2, "ingestion must have stored real records");

  const connectors = await prisma.sourceConnector.findMany();
  assert(
    connectors.some((c) => c.key === "planning_alerts_ws"),
    "planning connector present"
  );
  assert(
    connectors.some((c) => c.key === "asx_announcements"),
    "asx connector present"
  );

  const before = await prisma.ingestedRecord.count();
  const again = await runConnector("asx_announcements");
  assert(again.ok, "asx re-run ok");
  assert((again.duplicates ?? 0) >= 1, "duplicate ASX records detected");
  const after = await prisma.ingestedRecord.count();
  assert(after === before, "dedupe must not create duplicate ingested rows");

  const reviews = await prisma.matchReview.findMany({
    where: { status: "pending" },
    include: { record: true },
  });
  for (const r of reviews) {
    if (r.record.companySymbol && !r.record.addressRaw) {
      assert(
        r.record.matchStatus === "review",
        "company announcements without address stay in review"
      );
    }
  }

  console.log("Pilot tests passed.", {
    records,
    connectors: connectors.length,
    pendingReviews: reviews.length,
  });
}

main()
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
