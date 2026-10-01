import { format } from "date-fns";
import { prisma } from "@/lib/db";
import { resolveMatchReview } from "@/lib/ingestion-actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function ReviewPage() {
  const reviews = await prisma.matchReview.findMany({
    where: { status: "pending" },
    include: { record: true },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-heading text-2xl font-semibold tracking-tight">
          Match review queue
        </h2>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Uncertain matches stay here. Company-wide announcements are not attached
          to a warehouse without linking evidence. Ownership, lease and tenant
          details are never invented.
        </p>
      </div>

      {reviews.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-card/60 px-6 py-12 text-center text-sm text-muted-foreground">
          No pending reviews.
        </div>
      ) : (
        <div className="grid gap-3">
          {reviews.map((r) => (
            <Card key={r.id}>
              <CardHeader>
                <CardTitle className="text-base">{r.record.title}</CardTitle>
                <p className="text-sm text-muted-foreground">{r.reason}</p>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <p>{r.record.excerpt}</p>
                <p className="text-xs text-muted-foreground">
                  Retrieved{" "}
                  {format(r.record.retrievedAt, "dd MMM yyyy HH:mm")}
                  {r.record.eventDate
                    ? ` · Event ${format(r.record.eventDate, "dd MMM yyyy")}`
                    : ""}
                  {r.record.companySymbol
                    ? ` · ${r.record.companySymbol}`
                    : ""}
                </p>
                <a
                  href={r.record.sourceUrl}
                  className="text-sky-800 underline"
                  target="_blank"
                  rel="noreferrer"
                >
                  Open source
                </a>
                <div className="flex flex-wrap gap-2 pt-2">
                  {r.candidatePropertyId ? (
                    <form action={resolveMatchReview}>
                      <input type="hidden" name="id" value={r.id} />
                      <Button
                        type="submit"
                        name="action"
                        value="link_candidate"
                        size="sm"
                      >
                        Confirm candidate link
                      </Button>
                    </form>
                  ) : null}
                  <form action={resolveMatchReview}>
                    <input type="hidden" name="id" value={r.id} />
                    <Button
                      type="submit"
                      name="action"
                      value="dismiss"
                      size="sm"
                      variant="outline"
                    >
                      Dismiss
                    </Button>
                  </form>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
