import { prisma } from "@/lib/db";
import { getActiveWorkspace } from "@/lib/workspace";
import { OpportunityCard } from "@/components/opportunity-card";
import { FilterBar } from "@/components/filter-bar";
import { recalculateNow } from "@/lib/actions";
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
    include: { property: true },
    orderBy: [{ score: "desc" }, { newestEvidenceAt: "desc" }],
  });

  const suburbs = await prisma.property.findMany({
    where: { workspaceId: workspace.id },
    select: { suburb: true },
    distinct: ["suburb"],
    orderBy: { suburb: "asc" },
  });

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
          <p className="text-base font-medium">No opportunities yet</p>
          <p className="mt-2 text-sm text-muted-foreground">
            {workspace.mode === "live"
              ? "No live research leads yet. Open Sources and run ingestion — the live feed is never padded with fiction."
              : workspace.mode === "real"
                ? "Import a property CSV and add evidence to generate ranked leads."
                : "Run the seed script, switch workspace, or recalculate after adding evidence."}
          </p>
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
