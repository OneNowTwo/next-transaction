import { prisma } from "@/lib/db";
import { getActiveWorkspace } from "@/lib/workspace";
import {
  FEEDBACK_LABELS,
  FEEDBACK_LABEL_COPY,
  type FeedbackLabel,
} from "@/lib/constants";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function FeedbackPage() {
  const workspace = await getActiveWorkspace();
  const [feedback, opportunityCount] = await Promise.all([
    prisma.feedback.findMany({ where: { workspaceId: workspace.id } }),
    prisma.opportunity.count({ where: { workspaceId: workspace.id } }),
  ]);

  const assessed = feedback.length;
  const counts: Record<string, number> = Object.fromEntries(
    FEEDBACK_LABELS.map((l) => [l, 0])
  );
  for (const row of feedback) {
    const labels = JSON.parse(row.labels) as string[];
    for (const label of labels) {
      counts[label] = (counts[label] ?? 0) + 1;
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-heading text-2xl font-semibold tracking-tight">
          Feedback dashboard
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Measure whether opportunities save research time and produce useful
          conversations.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="Opportunities in feed" value={String(opportunityCount)} />
        <Stat label="Assessed" value={String(assessed)} />
        <Stat
          label="Assessment coverage"
          value={
            opportunityCount
              ? `${Math.round((assessed / opportunityCount) * 100)}%`
              : "0%"
          }
        />
      </div>

      {assessed === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-card/60 px-6 py-12 text-center text-sm text-muted-foreground">
          No feedback yet. Open an opportunity and capture usefulness labels.
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {FEEDBACK_LABELS.map((label) => {
            const count = counts[label] ?? 0;
            const pct = assessed ? Math.round((count / assessed) * 100) : 0;
            return (
              <Card key={label}>
                <CardHeader>
                  <CardTitle className="text-base">
                    {FEEDBACK_LABEL_COPY[label as FeedbackLabel]}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-semibold">{count}</p>
                  <p className="text-sm text-muted-foreground">
                    {pct}% of assessed
                  </p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="mt-1 text-3xl font-semibold">{value}</p>
      </CardContent>
    </Card>
  );
}
