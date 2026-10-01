import { differenceInDays, differenceInYears, parseISO, subMonths } from "date-fns";
import type { Evidence, Property, Rule } from "@prisma/client";
import { prisma } from "@/lib/db";

export type RuleConfig = {
  monthsAhead?: number;
  minOwnershipYears?: number;
  requireRecentMonths?: number;
  complementaryCategories?: string[];
  conflictingCategories?: string[];
  maxPriority?: "high" | "medium" | "low";
};

export type GeneratedOpportunity = {
  propertyId: string;
  type: "sale" | "leasing";
  priority: "high" | "medium" | "low";
  whyNow: string;
  evidenceQuality: "strong" | "moderate" | "weak" | "conflicting" | "incomplete";
  missingInfo: string[];
  suggestedAction: string;
  newestEvidenceAt: Date | null;
  score: number;
  isFictional: boolean;
  ruleHits: { ruleId: string; explanation: string; weightApplied: number }[];
  evidenceIds: string[];
};

function parseConfig(configJson: string): RuleConfig {
  try {
    return JSON.parse(configJson) as RuleConfig;
  } catch {
    return {};
  }
}

function dedupeEvidence(items: Evidence[]): Evidence[] {
  const seen = new Set<string>();
  const result: Evidence[] = [];
  for (const item of items) {
    if (item.isResolved) continue;
    const key =
      item.eventKey ||
      `${item.signalCategory}|${item.eventDate?.toISOString() ?? "na"}|${item.sourceTitle.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(item);
  }
  return result;
}

function evidenceStrength(item: Evidence, now: Date): number {
  let score = 10;
  if (item.verificationStatus === "verified") score += 25;
  if (item.verificationStatus === "unverified") score += 5;
  if (item.verificationStatus === "disputed") score -= 20;
  if (item.verificationStatus === "stale" || item.isStale) score -= 15;
  if (item.sourceUrl) score += 5;
  if (item.eventDate) {
    const ageDays = differenceInDays(now, item.eventDate);
    if (ageDays <= 90) score += 20;
    else if (ageDays <= 180) score += 10;
    else if (ageDays <= 365) score += 5;
    else score -= 5;
  }
  return score;
}

function qualityFrom(
  score: number,
  missing: string[],
  conflicting: boolean
): GeneratedOpportunity["evidenceQuality"] {
  if (conflicting) return "conflicting";
  if (missing.length >= 3) return "incomplete";
  if (score >= 90) return "strong";
  if (score >= 55) return "moderate";
  return "weak";
}

function priorityFrom(
  score: number,
  maxPriority?: "high" | "medium" | "low"
): "high" | "medium" | "low" {
  let priority: "high" | "medium" | "low" =
    score >= 85 ? "high" : score >= 50 ? "medium" : "low";
  const rank = { low: 0, medium: 1, high: 2 } as const;
  if (maxPriority && rank[priority] > rank[maxPriority]) {
    priority = maxPriority;
  }
  return priority;
}

function missingFacts(property: Property, evidence: Evidence[]): string[] {
  const missing: string[] = [];
  if (!property.ownerEntity) missing.push("Confirm current owner entity");
  if (!property.tenant) missing.push("Confirm current tenant");
  if (!property.leaseExpiry) missing.push("Confirm lease expiry date");
  if (!property.leaseOptionInfo) missing.push("Confirm option terms / exercise status");
  if (!property.leaseVerifiedAt) missing.push("Verify lease details with a dated source");
  if (!property.lastSaleDate) missing.push("Confirm last sale / ownership start date");
  const hasOwnerSignal = evidence.some((e) =>
    ["owner_disposal", "portfolio_activity", "owner_conversation", "appraisal"].includes(
      e.signalCategory
    )
  );
  if (hasOwnerSignal && !evidence.some((e) => e.verificationStatus === "verified")) {
    missing.push("Verify owner-side signal with primary source");
  }
  return missing;
}

function evaluateRule(
  rule: Rule,
  property: Property,
  evidence: Evidence[],
  now: Date
): { hit: boolean; explanation: string; weightApplied: number; evidenceIds: string[]; typeHint: "sale" | "leasing" | "either" } | null {
  if (!rule.enabled) return null;
  const config = parseConfig(rule.configJson);
  const active = evidence.filter((e) => !e.isResolved && e.verificationStatus !== "resolved");

  switch (rule.key) {
    case "approaching_lease_expiry": {
      if (!property.leaseExpiry) return null;
      const monthsAhead = config.monthsAhead ?? 12;
      const days = differenceInDays(property.leaseExpiry, now);
      if (days < 0 || days > monthsAhead * 30) return null;
      const related = active.filter((e) =>
        ["lease_expiry", "relocation", "consolidation", "tenant_contraction"].includes(
          e.signalCategory
        )
      );
      return {
        hit: true,
        explanation: `Lease expiry is within ${monthsAhead} months (${property.leaseExpiry.toISOString().slice(0, 10)}).`,
        weightApplied: rule.weight + (related.length ? 10 : 0),
        evidenceIds: related.map((e) => e.id),
        typeHint: "leasing",
      };
    }
    case "tenant_expansion_contraction": {
      const matches = active.filter((e) =>
        ["tenant_expansion", "tenant_contraction"].includes(e.signalCategory)
      );
      if (!matches.length) return null;
      return {
        hit: true,
        explanation: `Verified or reported tenant footprint change: ${matches
          .map((m) => m.signalCategory.replaceAll("_", " "))
          .join(", ")}.`,
        weightApplied: rule.weight,
        evidenceIds: matches.map((e) => e.id),
        typeHint: "leasing",
      };
    }
    case "relocation_consolidation": {
      const matches = active.filter((e) =>
        ["relocation", "consolidation"].includes(e.signalCategory)
      );
      if (!matches.length) return null;
      return {
        hit: true,
        explanation: `Tenant relocation/consolidation signal on record.`,
        weightApplied: rule.weight,
        evidenceIds: matches.map((e) => e.id),
        typeHint: "leasing",
      };
    }
    case "owner_disposal_portfolio": {
      const matches = active.filter((e) =>
        ["owner_disposal", "portfolio_activity"].includes(e.signalCategory)
      );
      if (!matches.length) return null;
      return {
        hit: true,
        explanation: `Owner disposal or portfolio activity reported.`,
        weightApplied: rule.weight,
        evidenceIds: matches.map((e) => e.id),
        typeHint: "sale",
      };
    }
    case "planning_activity": {
      const matches = active.filter((e) => e.signalCategory === "planning_activity");
      if (!matches.length) return null;
      return {
        hit: true,
        explanation: `A dated planning notice is on record for this address.`,
        weightApplied: rule.weight,
        evidenceIds: matches.map((e) => e.id),
        typeHint: "either",
      };
    }
    case "public_listing": {
      const matches = active.filter((e) => e.signalCategory === "public_listing");
      if (!matches.length) return null;
      const leased = matches.some((m) =>
        /leased|lease concluded|leased on/i.test(m.excerpt)
      );
      return {
        hit: true,
        explanation: leased
          ? `A public listing page reports this property as leased (already on the open market / concluded campaign).`
          : `A public for-lease or for-sale listing is already advertising this property on the open market.`,
        weightApplied: Math.min(rule.weight, leased ? 15 : 25),
        evidenceIds: matches.map((e) => e.id),
        typeHint: matches.some((m) => /for sale|sale listing/i.test(m.excerpt))
          ? "sale"
          : "leasing",
      };
    }
    case "long_ownership": {
      if (!property.lastSaleDate) return null;
      const years = differenceInYears(now, property.lastSaleDate);
      const minYears = config.minOwnershipYears ?? 10;
      if (years < minYears) return null;
      // Background only — capped priority via maxPriority in config
      return {
        hit: true,
        explanation: `Long ownership period (~${years} years). Background signal only.`,
        weightApplied: Math.min(rule.weight, 15),
        evidenceIds: [],
        typeHint: "sale",
      };
    }
    case "appraisal_or_conversation": {
      const matches = active.filter((e) =>
        ["appraisal", "owner_conversation"].includes(e.signalCategory)
      );
      if (!matches.length) return null;
      const recentMonths = config.requireRecentMonths ?? 24;
      const recent = matches.filter(
        (m) =>
          !m.eventDate ||
          m.eventDate >= subMonths(now, recentMonths)
      );
      if (!recent.length) return null;
      return {
        hit: true,
        explanation: `Previous appraisal or owner conversation on file.`,
        weightApplied: rule.weight,
        evidenceIds: recent.map((e) => e.id),
        typeHint: "sale",
      };
    }
    default:
      return null;
  }
}

export function generateOpportunitiesForProperty(
  property: Property,
  evidence: Evidence[],
  rules: Rule[],
  now = new Date()
): GeneratedOpportunity[] {
  const deduped = dedupeEvidence(evidence);
  const hits = rules
    .map((rule) => {
      const result = evaluateRule(rule, property, deduped, now);
      return result && result.hit ? { rule, ...result } : null;
    })
    .filter(Boolean) as Array<{
    rule: Rule;
    explanation: string;
    weightApplied: number;
    evidenceIds: string[];
    typeHint: "sale" | "leasing" | "either";
  }>;

  if (!hits.length) return [];

  const byType: Record<"sale" | "leasing", typeof hits> = {
    sale: [],
    leasing: [],
  };
  for (const hit of hits) {
    if (hit.typeHint === "either") {
      byType.sale.push(hit);
      byType.leasing.push(hit);
    } else {
      byType[hit.typeHint].push(hit);
    }
  }

  const results: GeneratedOpportunity[] = [];
  for (const type of ["sale", "leasing"] as const) {
    let typeHits = byType[type];
    if (!typeHits.length) continue;

    // "either" rules alone should not open both sale and leasing cards.
    const hasTypeSpecific = typeHits.some((h) => h.typeHint === type);
    if (!hasTypeSpecific) {
      if (type === "leasing") continue; // keep planning-only under sale
    }

    // Long ownership is background only — alone it must not create an opportunity,
    // and with weak support it cannot be high priority.
    const substantiveHits = typeHits.filter((h) => h.rule.key !== "long_ownership");
    if (!substantiveHits.length) continue;

    const onlyBackgroundPlusPlanning =
      type === "sale" &&
      substantiveHits.every((h) => h.rule.key === "planning_activity") &&
      typeHits.some((h) => h.rule.key === "long_ownership");

    const evidenceIds = Array.from(new Set(typeHits.flatMap((h) => h.evidenceIds)));
    const linkedEvidence = deduped.filter((e) => evidenceIds.includes(e.id));
    const strength = linkedEvidence.reduce((sum, e) => sum + evidenceStrength(e, now), 0);
    const weightSum = typeHits.reduce((sum, h) => sum + h.weightApplied, 0);
    let score = weightSum + Math.min(40, strength);

    const categories = new Set(linkedEvidence.map((e) => e.signalCategory));
    const conflicting =
      (categories.has("tenant_expansion") && categories.has("tenant_contraction")) ||
      linkedEvidence.some((e) => e.verificationStatus === "disputed") ||
      (categories.has("owner_disposal") &&
        linkedEvidence.some(
          (e) =>
            e.signalCategory === "owner_conversation" &&
            e.excerpt.toLowerCase().includes("not selling")
        ));

    if (conflicting) score -= 25;
    const missing = missingFacts(property, linkedEvidence);
    score -= Math.min(20, missing.length * 4);

    const listingOnly = substantiveHits.every((h) => h.rule.key === "public_listing");
    const planningOnly = substantiveHits.every((h) => h.rule.key === "planning_activity");

    let maxPriority: "high" | "medium" | "low" | undefined;
    if (onlyBackgroundPlusPlanning || listingOnly || planningOnly) {
      maxPriority = "low";
      score = Math.min(score, listingOnly ? 40 : 35);
    }

    // Public listings that already say "leased" are market context, not pursuit leads.
    const listingLeased = linkedEvidence.some(
      (e) =>
        e.signalCategory === "public_listing" &&
        /leased|lease concluded|leased on/i.test(e.excerpt)
    );
    if (listingLeased) {
      maxPriority = "low";
      score = Math.min(score, 25);
    }

    const priority = priorityFrom(score, maxPriority);
    const evidenceQuality = qualityFrom(score, missing, conflicting);
    const newestEvidenceAt =
      linkedEvidence
        .map((e) => e.eventDate ?? e.collectedAt)
        .sort((a, b) => b.getTime() - a.getTime())[0] ?? null;

    const support = typeHits.map((h) => h.explanation).join(" ");
    const verifiedBits = linkedEvidence.slice(0, 3).map((e) => {
      const when = e.eventDate ? e.eventDate.toISOString().slice(0, 10) : "date not published";
      const state =
        e.verificationStatus === "verified" ? "retrieved from the publisher" : e.verificationStatus;
      return `${e.sourceTitle} (${when}; ${state})`;
    });
    const verifiedLine = verifiedBits.length
      ? `Verified: ${verifiedBits.join(" · ")}.`
      : "Verified: no source record is linked yet.";
    const inferredLine =
      "Inferred: this card is a research ranking only. Owner, tenant, lease and any intention to sell or lease stay Unknown unless those facts are written in a source excerpt.";
    const missingLine =
      missing.length > 0 ? ` Still to verify: ${missing.slice(0, 3).join("; ")}.` : "";

    let whatChanged: string;
    let whyItMatters: string;
    let suggestedAction: string;
    if (listingLeased) {
      whatChanged = "a public listing reports this property as leased";
      whyItMatters = "this is market context, not an open vacancy";
      suggestedAction =
        "Do not approach as a live vacancy. File it as context and confirm any agency instruction separately.";
    } else if (listingOnly) {
      whatChanged = "this property is already publicly advertised";
      whyItMatters = "it is on the market already, not a pre-market discovery";
      suggestedAction =
        "Read the listing, note the agent if one is named, and only pursue it for a real brief.";
    } else if (planningOnly) {
      whatChanged = "a planning notice or major-project page was retrieved for this place";
      whyItMatters =
        "planning can change timing, but it is not proof that anyone wants to sell or lease";
      suggestedAction =
        "Open the source link, confirm the address and status, and see whether an applicant or owner is actually named. Do not guess the tenant.";
    } else if (type === "leasing") {
      whatChanged = support;
      whyItMatters = "this may be a leasing research lead, not a confirmed vacancy";
      suggestedAction =
        "Confirm the facility, any option, and who decides, before contacting anyone.";
    } else {
      whatChanged = support;
      whyItMatters = "this is a sale research ranking, not a prediction that the owner will sell";
      suggestedAction =
        "Check ownership and any existing listing instruction in a primary source before approaching.";
    }

    const whyNow = `What changed: ${whatChanged}. Why look now: ${whyItMatters}. What supports it: ${support} ${verifiedLine} ${inferredLine}${missingLine} Check next: ${suggestedAction}`;

    results.push({
      propertyId: property.id,
      type,
      priority,
      whyNow,
      evidenceQuality,
      missingInfo: missing,
      suggestedAction,
      newestEvidenceAt,
      score: Math.round(score),
      isFictional: property.isFictional,
      ruleHits: typeHits.map((h) => ({
        ruleId: h.rule.id,
        explanation: h.explanation,
        weightApplied: h.weightApplied,
      })),
      evidenceIds,
    });
  }

  return results;
}

export async function recalculateWorkspaceOpportunities(workspaceId: string) {
  const [properties, evidence, rules, existing] = await Promise.all([
    prisma.property.findMany({ where: { workspaceId } }),
    prisma.evidence.findMany({ where: { workspaceId } }),
    prisma.rule.findMany({ where: { workspaceId } }),
    prisma.opportunity.findMany({
      where: { workspaceId },
      include: { feedback: true, notes: true },
    }),
  ]);

  const evidenceByProperty = new Map<string, Evidence[]>();
  for (const item of evidence) {
    const list = evidenceByProperty.get(item.propertyId) ?? [];
    list.push(item);
    evidenceByProperty.set(item.propertyId, list);
  }

  const generated: GeneratedOpportunity[] = [];
  for (const property of properties) {
    generated.push(
      ...generateOpportunitiesForProperty(
        property,
        evidenceByProperty.get(property.id) ?? [],
        rules
      )
    );
  }

  // Preserve workflow state for matching property+type opportunities.
  // Notes/feedback are snapshotted first because opportunity delete cascades.
  type Preserved = {
    status: string;
    dismissReason: string | null;
    reviewDate: Date | null;
    aiSummary: string | null;
    noteIds: string[];
    feedbackLabels: string | null;
  };
  const preserveMap = new Map<string, Preserved>();
  for (const o of existing) {
    preserveMap.set(`${o.propertyId}:${o.type}`, {
      status: o.status,
      dismissReason: o.dismissReason,
      reviewDate: o.reviewDate,
      aiSummary: o.aiSummary,
      noteIds: o.notes.map((n) => n.id),
      feedbackLabels: o.feedback?.labels ?? null,
    });
  }

  await prisma.$transaction(async (tx) => {
    await tx.note.updateMany({
      where: { workspaceId, opportunityId: { not: null } },
      data: { opportunityId: null },
    });
    await tx.feedback.deleteMany({ where: { workspaceId } });
    await tx.opportunityRule.deleteMany({
      where: { opportunity: { workspaceId } },
    });
    await tx.opportunityEvidence.deleteMany({
      where: { opportunity: { workspaceId } },
    });
    await tx.opportunity.deleteMany({ where: { workspaceId } });

    for (const item of generated) {
      const key = `${item.propertyId}:${item.type}`;
      const previous = preserveMap.get(key);
      const created = await tx.opportunity.create({
        data: {
          workspaceId,
          propertyId: item.propertyId,
          type: item.type,
          priority: item.priority,
          status: previous?.status ?? "new",
          whyNow: item.whyNow,
          evidenceQuality: item.evidenceQuality,
          missingInfo: item.missingInfo.join(" | "),
          suggestedAction: item.suggestedAction,
          dismissReason: previous?.dismissReason,
          reviewDate: previous?.reviewDate,
          newestEvidenceAt: item.newestEvidenceAt,
          score: item.score,
          isFictional: item.isFictional,
          aiSummary: previous?.aiSummary,
        },
      });

      if (item.ruleHits.length) {
        await tx.opportunityRule.createMany({
          data: item.ruleHits.map((hit) => ({
            opportunityId: created.id,
            ruleId: hit.ruleId,
            explanation: hit.explanation,
            weightApplied: hit.weightApplied,
          })),
        });
      }
      if (item.evidenceIds.length) {
        await tx.opportunityEvidence.createMany({
          data: item.evidenceIds.map((evidenceId) => ({
            opportunityId: created.id,
            evidenceId,
          })),
        });
      }

      if (previous?.noteIds.length) {
        await tx.note.updateMany({
          where: { id: { in: previous.noteIds } },
          data: { opportunityId: created.id },
        });
      }
      if (previous?.feedbackLabels) {
        await tx.feedback.create({
          data: {
            workspaceId,
            opportunityId: created.id,
            labels: previous.feedbackLabels,
          },
        });
      }
    }
  });

  return generated.length;
}

export const DEFAULT_RULES: Array<{
  key: string;
  name: string;
  description: string;
  opportunityType: string;
  weight: number;
  configJson: string;
}> = [
  {
    key: "approaching_lease_expiry",
    name: "Approaching lease expiry",
    description: "Lease expiry within the configured horizon creates a leasing research lead.",
    opportunityType: "leasing",
    weight: 40,
    configJson: JSON.stringify({ monthsAhead: 12 }),
  },
  {
    key: "tenant_expansion_contraction",
    name: "Tenant expansion or contraction",
    description: "Reported change in tenant footprint can create leasing or vacancy work.",
    opportunityType: "leasing",
    weight: 35,
    configJson: "{}",
  },
  {
    key: "relocation_consolidation",
    name: "Relocation or consolidation",
    description: "Announced relocation/consolidation may affect the facility.",
    opportunityType: "leasing",
    weight: 40,
    configJson: "{}",
  },
  {
    key: "owner_disposal_portfolio",
    name: "Owner disposal or portfolio activity",
    description: "Owner-side disposal signals create sale research leads.",
    opportunityType: "sale",
    weight: 45,
    configJson: "{}",
  },
  {
    key: "planning_activity",
    name: "Relevant planning activity",
    description: "Planning applications can support sale or leasing timing research.",
    opportunityType: "either",
    weight: 20,
    configJson: "{}",
  },
  {
    key: "long_ownership",
    name: "Long ownership period",
    description: "Background ownership tenure. Alone, never high priority.",
    opportunityType: "sale",
    weight: 15,
    configJson: JSON.stringify({ minOwnershipYears: 10, maxPriority: "low" }),
  },
  {
    key: "appraisal_or_conversation",
    name: "Appraisal or owner conversation",
    description: "Prior appraisal or owner discussion supports a sale research lead.",
    opportunityType: "sale",
    weight: 35,
    configJson: JSON.stringify({ requireRecentMonths: 24 }),
  },
  {
    key: "public_listing",
    name: "Public market listing",
    description:
      "Property already advertised publicly. Useful for workflow testing and market context — never framed as a pre-market discovery.",
    opportunityType: "either",
    weight: 25,
    configJson: "{}",
  },
];

export function parseDateInput(value?: string | null): Date | null {
  if (!value || !value.trim()) return null;
  try {
    const d = parseISO(value);
    return Number.isNaN(d.getTime()) ? null : d;
  } catch {
    return null;
  }
}
