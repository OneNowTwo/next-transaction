import Link from "next/link";
import { format } from "date-fns";
import type { Evidence, Opportunity, Property } from "@prisma/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  PriorityBadge,
  StatusBadge,
  QualityBadge,
  TypeBadge,
  FictionalBadge,
} from "@/components/badges";

type Opp = Opportunity & {
  property: Property;
  evidence?: Array<{ evidence: Evidence }>;
};

export function OpportunityCard({ opportunity }: { opportunity: Opp }) {
  return (
    <Link href={`/opportunities/${opportunity.id}`} className="block">
      <Card className="transition hover:border-foreground/20 hover:shadow-sm">
        <CardHeader className="gap-3">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <CardTitle className="text-lg">
                {opportunity.property.address}
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                {opportunity.property.suburb}
              </p>
            </div>
            <div className="flex flex-wrap gap-1.5">
              <TypeBadge value={opportunity.type} />
              <PriorityBadge value={opportunity.priority} />
              <StatusBadge value={opportunity.status} />
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm leading-relaxed text-foreground/90">
            {opportunity.whyNow}
          </p>
          {opportunity.suggestedAction ? (
            <p className="text-sm text-foreground/80">
              <span className="font-medium">Check next: </span>
              {opportunity.suggestedAction}
            </p>
          ) : null}
          {opportunity.evidence && opportunity.evidence.length > 0 ? (
            <ul className="space-y-1 text-xs text-muted-foreground">
              {opportunity.evidence.slice(0, 2).map((link) => (
                <li key={link.evidence.id}>
                  <span className="font-medium text-foreground/80">
                    {link.evidence.verificationStatus === "verified" ? "Verified" : "Unverified"}
                    :{" "}
                  </span>
                  {link.evidence.sourceTitle}
                  {link.evidence.eventDate
                    ? ` · ${format(link.evidence.eventDate, "dd MMM yyyy")}`
                    : ""}
                  {link.evidence.sourceUrl ? " · source linked on the detail page" : ""}
                </li>
              ))}
            </ul>
          ) : null}
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <QualityBadge value={opportunity.evidenceQuality} />
            <span>
              Newest evidence:{" "}
              {opportunity.newestEvidenceAt
                ? format(opportunity.newestEvidenceAt, "dd MMM yyyy")
                : "Unknown"}
            </span>
            <span>Score {opportunity.score}</span>
            {opportunity.isFictional ? <FictionalBadge /> : null}
          </div>
          {opportunity.missingInfo ? (
            <p className="text-xs text-amber-800">
              Missing: {opportunity.missingInfo.split(" | ").slice(0, 2).join("; ")}
              {opportunity.missingInfo.split(" | ").length > 2 ? "…" : ""}
            </p>
          ) : null}
        </CardContent>
      </Card>
    </Link>
  );
}
