import { prisma } from "@/lib/db";
import { runAllConnectors, runConnector } from "@/lib/ingestion/pipeline";

let chain: Promise<unknown> = Promise.resolve();
let autoScheduled = false;

function skipDuringBuild() {
  return process.env.NEXT_PHASE === "phase-production-build" || !process.env.DATABASE_URL;
}

/** Run connectors one after another in this Node process. Safe to call more than once. */
export function scheduleIngest(key: string = "all") {
  if (skipDuringBuild()) return;
  chain = chain
    .then(async () => {
      if (key === "all") await runAllConnectors();
      else await runConnector(key);
    })
    .catch((err) => {
      console.error("Ingest failed", err);
    });
}

/**
 * First boot / first login: if Live has no opportunities and nothing is already
 * running, collect public sources. Does not seed fictional demo data.
 */
export async function runLiveIngestIfEmpty() {
  if (skipDuringBuild()) return { skipped: true, reason: "no database" };

  const live = await prisma.workspace.findFirst({ where: { mode: "live" } });
  if (live) {
    const opportunities = await prisma.opportunity.count({
      where: { workspaceId: live.id, isFictional: false },
    });
    if (opportunities > 0) {
      return { skipped: true, reason: "live feed already has opportunities", opportunities };
    }
  }

  const running = await prisma.ingestionRun.count({
    where: {
      status: "running",
      startedAt: { gt: new Date(Date.now() - 20 * 60 * 1000) },
    },
  });
  if (running > 0) return { skipped: true, reason: "ingest already running" };

  const result = await runAllConnectors();
  return { skipped: false, result };
}

export function scheduleLiveIngestIfEmpty() {
  if (skipDuringBuild() || autoScheduled) return;
  autoScheduled = true;
  chain = chain
    .then(async () => {
      await runLiveIngestIfEmpty();
    })
    .catch((err) => {
      console.error("First-run ingest failed", err);
    });
}
