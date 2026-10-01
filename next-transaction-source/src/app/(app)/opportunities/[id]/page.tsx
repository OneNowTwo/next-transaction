import Link from "next/link";
import { notFound } from "next/navigation";
import { format } from "date-fns";
import { prisma } from "@/lib/db";
import {
  addNote,
  saveFeedback,
  setReviewDate,
  updateOpportunityStatus,
  runAiAssist,
} from "@/lib/actions";
import { isAiConfigured } from "@/lib/ai";
import {
  FEEDBACK_LABELS,
  FEEDBACK_LABEL_COPY,
  SIGNAL_CATEGORY_COPY,
  formatLabel,
  unknownOr,
  type FeedbackLabel,
  type SignalCategory,
} from "@/lib/constants";
import {
  PriorityBadge,
  StatusBadge,
  QualityBadge,
  TypeBadge,
  FictionalBadge,
} from "@/components/badges";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default async function OpportunityDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const opportunity = await prisma.opportunity.findUnique({
    where: { id },
    include: {
      property: true,
      rules: { include: { rule: true } },
      evidence: { include: { evidence: true } },
      notes: { orderBy: { createdAt: "desc" } },
      feedback: true,
    },
  });
  if (!opportunity) notFound();

  const selectedFeedback: string[] = opportunity.feedback
    ? (JSON.parse(opportunity.feedback.labels) as string[])
    : [];

  let aiPayload: {
    summary?: string;
    opportunityExplanation?: string;
    missingToVerify?: string[];
    suggestedNextAction?: string;
    usedModel?: string;
  } | null = null;
  if (opportunity.aiSummary) {
    try {
      aiPayload = JSON.parse(opportunity.aiSummary);
    } catch {
      aiPayload = null;
    }
  }

  const timeline = [...opportunity.evidence]
    .map((link) => link.evidence)
    .sort((a, b) => {
      const da = (a.eventDate ?? a.collectedAt).getTime();
      const db = (b.eventDate ?? b.collectedAt).getTime();
      return db - da;
    });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground">
            <Link href="/" className="hover:underline">
              Opportunities
            </Link>{" "}
            / detail
          </p>
          <h2 className="mt-1 font-heading text-3xl font-semibold tracking-tight">
            {opportunity.property.address}
          </h2>
          <p className="text-muted-foreground">{opportunity.property.suburb}</p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            <TypeBadge value={opportunity.type} />
            <PriorityBadge value={opportunity.priority} />
            <StatusBadge value={opportunity.status} />
            <QualityBadge value={opportunity.evidenceQuality} />
            {opportunity.isFictional ? <FictionalBadge /> : null}
          </div>
        </div>
        <Link
          href={`/properties/${opportunity.propertyId}`}
          className="text-sm text-sky-800 underline-offset-2 hover:underline"
        >
          View property register entry
        </Link>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Why now</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-md border border-sky-100 bg-sky-50/70 p-3 text-sm leading-relaxed">
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-sky-900">
                Inferred research lead — not a verified fact or transaction certainty
              </p>
              <p>{opportunity.whyNow}</p>
              <p className="mt-2 text-xs text-sky-900/80">
                Reported events live in the evidence timeline below. This card
                interprets those events; it does not invent ownership, lease
                terms, or market exclusivity.
              </p>
            </div>
            <div>
              <h3 className="text-sm font-semibold">Rules that fired</h3>
              <ul className="mt-2 space-y-2">
                {opportunity.rules.map((hit) => (
                  <li
                    key={hit.id}
                    className="rounded-md border border-border bg-muted/40 px-3 py-2 text-sm"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-medium">{hit.rule.name}</span>
                      <span className="text-xs text-muted-foreground">
                        weight {hit.weightApplied}
                      </span>
                    </div>
                    <p className="mt-1 text-muted-foreground">{hit.explanation}</p>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h3 className="text-sm font-semibold">Suggested next action</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                {opportunity.suggestedAction ?? "Review evidence and decide next contact."}
              </p>
            </div>
            {opportunity.missingInfo ? (
              <div>
                <h3 className="text-sm font-semibold">Missing facts to verify</h3>
                <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-amber-900">
                  {opportunity.missingInfo.split(" | ").map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Property facts</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <Fact label="Owner" value={unknownOr(opportunity.property.ownerEntity)} />
            <Fact label="Tenant" value={unknownOr(opportunity.property.tenant)} />
            <Fact
              label="Lease expiry"
              value={
                opportunity.property.leaseExpiry
                  ? format(opportunity.property.leaseExpiry, "dd MMM yyyy")
                  : "Unknown"
              }
            />
            <Fact
              label="Option info"
              value={unknownOr(opportunity.property.leaseOptionInfo)}
            />
            <Fact
              label="Lease verified"
              value={
                opportunity.property.leaseVerifiedAt
                  ? format(opportunity.property.leaseVerifiedAt, "dd MMM yyyy")
                  : "Unknown"
              }
            />
            <Fact
              label="Last sale"
              value={
                opportunity.property.lastSaleDate
                  ? format(opportunity.property.lastSaleDate, "dd MMM yyyy")
                  : "Unknown"
              }
            />
            <Fact
              label="Building area"
              value={unknownOr(opportunity.property.buildingAreaSqm, " sqm")}
            />
            <Fact
              label="Assigned agent"
              value={unknownOr(opportunity.property.assignedAgent)}
            />
            <Fact
              label="Relationship notes"
              value={unknownOr(opportunity.property.relationshipNotes)}
            />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Evidence timeline</CardTitle>
        </CardHeader>
        <CardContent>
          {timeline.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No linked evidence yet.
            </p>
          ) : (
            <ol className="space-y-3">
              {timeline.map((item) => (
                <li
                  key={item.id}
                  className="rounded-md border border-border bg-background px-3 py-3"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-medium">{item.sourceTitle}</p>
                    <p className="text-xs text-muted-foreground">
                      {(item.eventDate ?? item.collectedAt)
                        ? format(item.eventDate ?? item.collectedAt, "dd MMM yyyy")
                        : "Unknown date"}
                    </p>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {SIGNAL_CATEGORY_COPY[item.signalCategory as SignalCategory] ??
                      formatLabel(item.signalCategory)}{" "}
                    · {formatLabel(item.sourceType)} ·{" "}
                    {formatLabel(item.verificationStatus)}
                    {item.isStale ? " · Stale" : ""}
                    {item.isFictional ? " · Fictional" : ""}
                  </p>
                  <p className="mt-2 text-sm">{item.excerpt}</p>
                  {item.sourceUrl ? (
                    <p className="mt-2 text-xs text-muted-foreground">
                      Reference URL (not auto-fetched):{" "}
                      <a
                        href={item.sourceUrl}
                        className="underline"
                        target="_blank"
                        rel="noreferrer"
                      >
                        {item.sourceUrl}
                      </a>
                    </p>
                  ) : null}
                </li>
              ))}
            </ol>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Workflow actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <form action={updateOpportunityStatus} className="flex flex-wrap gap-2">
              <input type="hidden" name="id" value={opportunity.id} />
              {["saved", "investigating", "contacted"].map((status) => (
                <Button key={status} name="status" value={status} size="sm">
                  Mark {status}
                </Button>
              ))}
            </form>
            <form action={updateOpportunityStatus} className="space-y-2">
              <input type="hidden" name="id" value={opportunity.id} />
              <input type="hidden" name="status" value="dismissed" />
              <Label htmlFor="dismissReason">Dismiss with reason</Label>
              <Textarea
                id="dismissReason"
                name="dismissReason"
                placeholder="Why is this not actionable?"
                required
              />
              <Button type="submit" variant="outline" size="sm">
                Dismiss
              </Button>
            </form>
            <form action={setReviewDate} className="space-y-2">
              <input type="hidden" name="id" value={opportunity.id} />
              <Label htmlFor="reviewDate">Review date</Label>
              <div className="flex gap-2">
                <Input
                  id="reviewDate"
                  name="reviewDate"
                  type="date"
                  defaultValue={
                    opportunity.reviewDate
                      ? opportunity.reviewDate.toISOString().slice(0, 10)
                      : ""
                  }
                />
                <Button type="submit" size="sm" variant="secondary">
                  Set
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Notes & feedback</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <form action={addNote} className="space-y-2">
              <input type="hidden" name="opportunityId" value={opportunity.id} />
              <input
                type="hidden"
                name="propertyId"
                value={opportunity.propertyId}
              />
              <Label htmlFor="body">Add note</Label>
              <Textarea id="body" name="body" required placeholder="Agent note…" />
              <Button type="submit" size="sm">
                Save note
              </Button>
            </form>
            <ul className="space-y-2">
              {opportunity.notes.map((note) => (
                <li
                  key={note.id}
                  className="rounded-md border border-border px-3 py-2 text-sm"
                >
                  <p>{note.body}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {format(note.createdAt, "dd MMM yyyy HH:mm")}
                  </p>
                </li>
              ))}
            </ul>
            <form action={saveFeedback} className="space-y-2">
              <input type="hidden" name="opportunityId" value={opportunity.id} />
              <p className="text-sm font-medium">Usefulness feedback</p>
              <div className="grid gap-2 sm:grid-cols-2">
                {FEEDBACK_LABELS.map((label) => (
                  <label key={label} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      name="labels"
                      value={label}
                      defaultChecked={selectedFeedback.includes(label)}
                    />
                    {FEEDBACK_LABEL_COPY[label as FeedbackLabel]}
                  </label>
                ))}
              </div>
              <Button type="submit" size="sm" variant="secondary">
                Save feedback
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Optional AI assist</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {isAiConfigured() ? (
            <>
              <form
                action={async () => {
                  "use server";
                  await runAiAssist(opportunity.id);
                }}
              >
                <Button type="submit" size="sm">
                  Generate AI summary from evidence
                </Button>
              </form>
              {aiPayload ? (
                <div className="space-y-2 rounded-md border border-border bg-muted/30 p-3 text-sm">
                  <p>
                    <strong>Summary:</strong> {aiPayload.summary}
                  </p>
                  <p>
                    <strong>Explanation:</strong>{" "}
                    {aiPayload.opportunityExplanation}
                  </p>
                  <p>
                    <strong>Next action:</strong> {aiPayload.suggestedNextAction}
                  </p>
                  {aiPayload.missingToVerify?.length ? (
                    <ul className="list-disc pl-5">
                      {aiPayload.missingToVerify.map((m) => (
                        <li key={m}>{m}</li>
                      ))}
                    </ul>
                  ) : null}
                  <p className="text-xs text-muted-foreground">
                    Model: {aiPayload.usedModel}. Facts must cite evidence ids.
                  </p>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No AI summary yet. Core scoring remains rule-based.
                </p>
              )}
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              AI is optional. Set <code>OPENAI_API_KEY</code> in{" "}
              <code>.env</code> to enable summaries. The core app works without
              it.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3 border-b border-border/70 py-1.5 last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{value}</span>
    </div>
  );
}
