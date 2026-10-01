export const WORKSPACE_COOKIE = "nt_workspace_id";

export const SIGNAL_CATEGORIES = [
  "lease_expiry",
  "tenant_expansion",
  "tenant_contraction",
  "relocation",
  "consolidation",
  "owner_disposal",
  "portfolio_activity",
  "planning_activity",
  "long_ownership",
  "appraisal",
  "owner_conversation",
  "public_listing",
  "other",
] as const;

export type SignalCategory = (typeof SIGNAL_CATEGORIES)[number];

export const SOURCE_TYPES = [
  "news",
  "asic",
  "planning",
  "lease_record",
  "agent_note",
  "owner_conversation",
  "company_announcement",
  "public_listing",
  "other",
] as const;

export const VERIFICATION_STATUSES = [
  "verified",
  "unverified",
  "disputed",
  "stale",
  "resolved",
] as const;

export const OPPORTUNITY_TYPES = ["sale", "leasing"] as const;
export const PRIORITIES = ["high", "medium", "low"] as const;
export const STATUSES = [
  "new",
  "saved",
  "investigating",
  "contacted",
  "dismissed",
] as const;

export const EVIDENCE_QUALITY = [
  "strong",
  "moderate",
  "weak",
  "conflicting",
  "incomplete",
] as const;

export const FEEDBACK_LABELS = [
  "new_to_me",
  "already_knew",
  "useful",
  "not_relevant",
  "incorrect_information",
  "resulted_in_conversation",
] as const;

export type FeedbackLabel = (typeof FEEDBACK_LABELS)[number];

export const FEEDBACK_LABEL_COPY: Record<FeedbackLabel, string> = {
  new_to_me: "New to me",
  already_knew: "Already knew",
  useful: "Useful",
  not_relevant: "Not relevant",
  incorrect_information: "Incorrect information",
  resulted_in_conversation: "Resulted in a conversation",
};

export const SIGNAL_CATEGORY_COPY: Record<SignalCategory, string> = {
  lease_expiry: "Lease expiry",
  tenant_expansion: "Tenant expansion",
  tenant_contraction: "Tenant contraction",
  relocation: "Relocation",
  consolidation: "Consolidation",
  owner_disposal: "Owner disposal",
  portfolio_activity: "Portfolio activity",
  planning_activity: "Planning activity",
  long_ownership: "Long ownership",
  appraisal: "Previous appraisal",
  owner_conversation: "Owner conversation",
  public_listing: "Public listing",
  other: "Other",
};

export function formatLabel(value: string): string {
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function unknownOr(value: string | number | null | undefined, suffix = ""): string {
  if (value === null || value === undefined || value === "") return "Unknown";
  return `${value}${suffix}`;
}
