import { prisma } from "@/lib/db";
import { getActiveWorkspace } from "@/lib/workspace";
import { OpportunityCard } from "@/components/opportunity-card";
import { FilterBar } from "@/components/filter-bar";
import { recalculateNow } from "@/lib/actions";
import { runIngestionAction } from "@/lib/ingestion-actions";
import { Button } from "@/components/ui/button";

export default async function OpportunityFeedPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const workspace = await getActiveWorkspace();

  const opportunities = await prisma.opportunity.findMany({
    where: {
      workspaceId: workspace.id,
      ...(params.type ? { type: params.type } : {}),
      ...(params.priority ? { priority: params.priority } : {}),
      ...(params.status ? { status: params.status } : {}),
      ...(params.suburb
        ? { property: { suburb: params.suburb } }
        : {}),
      ...(params.q
        ? {
            property: {
              address: { contains: params.q },
            },
          }
        : {}),
    },
    include: {
      property: true,
      evidence: { include: { evidence: true }, take: 3 },
    },
    orderBy: [{ score: "desc" }, { newestEvidenceAt: "desc" }],
  });

  const [suburbs, runningIngest, retrievedCount, reviewCount] = await Promise.all([
    prisma.property.findMany({
    where: { workspaceId: workspace.id },
    select: { suburb: true },
    distinct: ["suburb"],
    orderBy: { suburb: "asc" },
    }),
    prisma.ingestionRun.count({
      where: {
        status: "running",
        startedAt: { gt: new Date(Date.now() - 20 * 60 * 1000) },
      },
    }),
    prisma.ingestedRecord.count({ where: { workspaceId: workspace.id } }),
    prisma.matchReview.count({ where: { workspaceId: workspace.id, status: "pending" } }),
  ]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-heading text-2xl font-semibold tracking-tight">
            Opportunity feed
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Ranked research leads from transparent rules. Priority is a research
            ranking, not a probability of transaction.
          </p>
        </div>
        <form action={recalculateNow}>
          <Button type="submit" variant="outline" size="sm">
            Recalculate opportunities
          </Button>
        </form>
      </div>

      <FilterBar
        suburbs={suburbs.map((s) => s.suburb)}
        filters={{
          suburb: params.suburb,
          type: params.type,
          priority: params.priority,
          status: params.status,
          q: params.q,
        }}
      />

      {opportunities.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-card/60 px-6 py-16 text-center">
          <p className="text-base font-medium">
            {workspace.mode === "live" && runningIngest > 0
              ? "Collecting public records"
              : "No opportunities yet"}
          </p>
          <p className="mx-auto mt-2 max-w-xl text-sm text-muted-foreground">
            {workspace.mode === "live"
              ? runningIngest > 0
                ? "Sources are running now (Planning Alerts, NSW major projects, ASX announcements, and industrial media). Refresh this page in a minute. The feed only shows records those sources actually returned."
                : "Live pilot starts empty until public sources are collected. Nothing fictional is added here. Run sources, then refresh. Retrieved records in this workspace: " +
                  retrievedCount +
                  ". Waiting in review: " +
                  reviewCount +
                  "."
              : workspace.mode === "real"
                ? "Import a property CSV and add evidence to generate ranked leads."
                : "Demo and trial stay separate from Live. Seed the demo with npm run db:seed if you want sample records. Live is real sources only."}
          </p>
          {workspace.mode === "live" ? (
            <form action={runIngestionAction.bind(null, "all")} className="mt-4">
              <Button type="submit">Run sources</Button>
            </form>
          ) : null}
        </div>
      ) : (
        <div className="grid gap-3">
          {opportunities.map((opportunity) => (
            <OpportunityCard key={opportunity.id} opportunity={opportunity} />
          ))}
        </div>
      )}
    </div>
  );
}
