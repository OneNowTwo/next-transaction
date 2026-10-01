import { format } from "date-fns";
import { prisma } from "@/lib/db";
import { runIngestionAction } from "@/lib/ingestion-actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function SourcesPage() {
  const connectors = await prisma.sourceConnector.findMany({
    orderBy: { name: "asc" },
    include: {
      runs: { orderBy: { startedAt: "desc" }, take: 5 },
      _count: { select: { records: true } },
    },
  });

  const pendingReviews = await prisma.matchReview.count({
    where: { status: "pending" },
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-heading text-2xl font-semibold tracking-tight">
            Source health
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Working integrations retrieve and store real records. Last successful
            refresh and failures are shown here. Pending match reviews:{" "}
            <a href="/review" className="underline">
              {pendingReviews}
            </a>
            .
          </p>
        </div>
        <form action={runIngestionAction.bind(null, "all")}>
          <Button type="submit">Run all ingestions now</Button>
        </form>
      </div>

      {connectors.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-card/60 px-6 py-12 text-center text-sm text-muted-foreground">
          No connectors registered yet. Run ingestion to bootstrap them.
          <form action={runIngestionAction.bind(null, "all")} className="mt-4">
            <Button type="submit" variant="secondary">
              Bootstrap & run
            </Button>
          </form>
        </div>
      ) : (
        <div className="grid gap-3">
          {connectors.map((c) => (
            <Card key={c.id}>
              <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-2">
                <div>
                  <CardTitle className="text-lg">{c.name}</CardTitle>
                  <p className="text-sm text-muted-foreground">
                    {c.publisher} · {c.sourceType} · {c._count.records} stored
                    records
                  </p>
                </div>
                <form action={runIngestionAction.bind(null, c.key)}>
                  <Button type="submit" size="sm" variant="outline">
                    Refresh
                  </Button>
                </form>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex flex-wrap gap-4">
                  <span>
                    Status: <strong className="capitalize">{c.status}</strong>
                  </span>
                  <span>
                    Last success:{" "}
                    {c.lastSuccessAt
                      ? format(c.lastSuccessAt, "dd MMM yyyy HH:mm")
                      : "Never"}
                  </span>
                  <span>
                    Last attempt:{" "}
                    {c.lastAttemptAt
                      ? format(c.lastAttemptAt, "dd MMM yyyy HH:mm")
                      : "Never"}
                  </span>
                  <span>Last retrieved: {c.lastRetrievedCount}</span>
                </div>
                {c.lastError ? (
                  <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-red-800">
                    {c.lastError}
                  </p>
                ) : null}
                <div>
                  <p className="font-medium">Recent runs</p>
                  <ul className="mt-1 space-y-1 text-muted-foreground">
                    {c.runs.length === 0 ? (
                      <li>No runs yet.</li>
                    ) : (
                      c.runs.map((r) => (
                        <li key={r.id}>
                          {format(r.startedAt, "dd MMM HH:mm")} · {r.status} ·
                          retrieved {r.retrievedCount}, new {r.createdCount},
                          dupes {r.duplicateCount}
                          {r.errorMessage ? ` · ${r.errorMessage}` : ""}
                        </li>
                      ))
                    )}
                  </ul>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
