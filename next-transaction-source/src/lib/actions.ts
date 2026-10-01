"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import {
  getActiveWorkspace,
  setActiveWorkspaceId,
  ensureWorkspaces,
} from "@/lib/workspace";
import { parsePropertyCsv } from "@/lib/csv";
import { parseDateInput, recalculateWorkspaceOpportunities } from "@/lib/rules";
import { generateAiAssist, isAiConfigured } from "@/lib/ai";

export async function switchWorkspace(
  mode: "demo" | "real" | "trial" | "live"
) {
  const { demo, real, trial, live } = await ensureWorkspaces();
  const id =
    mode === "demo"
      ? demo.id
      : mode === "trial"
        ? trial.id
        : mode === "live"
          ? live.id
          : real.id;
  await setActiveWorkspaceId(id);
  revalidatePath("/", "layout");
}

export async function updateOpportunityStatus(formData: FormData): Promise<void> {
  const id = String(formData.get("id") || "");
  const status = String(formData.get("status") || "");
  const dismissReason = String(formData.get("dismissReason") || "") || null;
  const reviewDate = parseDateInput(String(formData.get("reviewDate") || ""));
  if (!id || !status) return;

  await prisma.opportunity.update({
    where: { id },
    data: {
      status,
      dismissReason: status === "dismissed" ? dismissReason : null,
      reviewDate: reviewDate ?? undefined,
    },
  });
  revalidatePath("/");
  revalidatePath(`/opportunities/${id}`);
}

export async function setReviewDate(formData: FormData): Promise<void> {
  const id = String(formData.get("id") || "");
  const reviewDate = parseDateInput(String(formData.get("reviewDate") || ""));
  await prisma.opportunity.update({
    where: { id },
    data: { reviewDate },
  });
  revalidatePath(`/opportunities/${id}`);
}

export async function addNote(formData: FormData): Promise<void> {
  const workspace = await getActiveWorkspace();
  const body = String(formData.get("body") || "").trim();
  const opportunityId = String(formData.get("opportunityId") || "") || null;
  const propertyId = String(formData.get("propertyId") || "") || null;
  if (!body) return;

  await prisma.note.create({
    data: {
      workspaceId: workspace.id,
      body,
      opportunityId,
      propertyId,
    },
  });
  revalidatePath("/");
  if (opportunityId) revalidatePath(`/opportunities/${opportunityId}`);
  if (propertyId) revalidatePath(`/properties/${propertyId}`);
}

export async function saveFeedback(formData: FormData): Promise<void> {
  const workspace = await getActiveWorkspace();
  const opportunityId = String(formData.get("opportunityId") || "");
  const labels = formData.getAll("labels").map(String);
  if (!opportunityId) return;

  await prisma.feedback.upsert({
    where: {
      workspaceId_opportunityId: {
        workspaceId: workspace.id,
        opportunityId,
      },
    },
    create: {
      workspaceId: workspace.id,
      opportunityId,
      labels: JSON.stringify(labels),
    },
    update: { labels: JSON.stringify(labels) },
  });
  revalidatePath(`/opportunities/${opportunityId}`);
  revalidatePath("/feedback");
}

export async function upsertProperty(formData: FormData): Promise<void> {
  const workspace = await getActiveWorkspace();
  const id = String(formData.get("id") || "") || null;
  const data = {
    address: String(formData.get("address") || "").trim(),
    suburb: String(formData.get("suburb") || "").trim(),
    propertyType: String(formData.get("propertyType") || "Industrial").trim(),
    landAreaSqm: numOrNull(formData.get("landAreaSqm")),
    buildingAreaSqm: numOrNull(formData.get("buildingAreaSqm")),
    ownerEntity: emptyToNull(formData.get("ownerEntity")),
    tenant: emptyToNull(formData.get("tenant")),
    lastSaleDate: parseDateInput(String(formData.get("lastSaleDate") || "")),
    leaseExpiry: parseDateInput(String(formData.get("leaseExpiry") || "")),
    leaseOptionInfo: emptyToNull(formData.get("leaseOptionInfo")),
    leaseVerifiedAt: parseDateInput(String(formData.get("leaseVerifiedAt") || "")),
    assignedAgent: emptyToNull(formData.get("assignedAgent")),
    relationshipNotes: emptyToNull(formData.get("relationshipNotes")),
    isFictional: workspace.isFictional,
  };
  if (!data.address || !data.suburb) return;

  let propertyId = id;
  if (id) {
    await prisma.property.update({ where: { id }, data });
  } else {
    const created = await prisma.property.create({
      data: { ...data, workspaceId: workspace.id },
    });
    propertyId = created.id;
  }

  await recalculateWorkspaceOpportunities(workspace.id);
  revalidatePath("/properties");
  revalidatePath("/");
  if (propertyId) revalidatePath(`/properties/${propertyId}`);
}

export async function addEvidence(formData: FormData): Promise<void> {
  const workspace = await getActiveWorkspace();
  const propertyId = String(formData.get("propertyId") || "");
  if (!propertyId) return;

  const eventKeyRaw = emptyToNull(formData.get("eventKey"));
  const signalCategory = String(formData.get("signalCategory") || "other");
  const eventDate = parseDateInput(String(formData.get("eventDate") || ""));
  const sourceTitle = String(formData.get("sourceTitle") || "").trim();
  const excerpt = String(formData.get("excerpt") || "").trim();
  if (!sourceTitle || !excerpt) return;

  const eventKey =
    eventKeyRaw ||
    `${propertyId}|${signalCategory}|${eventDate?.toISOString().slice(0, 10) ?? "na"}|${sourceTitle.toLowerCase()}`;

  const duplicate = await prisma.evidence.findFirst({
    where: { workspaceId: workspace.id, eventKey },
  });
  if (duplicate) return;

  await prisma.evidence.create({
    data: {
      workspaceId: workspace.id,
      propertyId,
      signalCategory,
      sourceTitle,
      sourceUrl: emptyToNull(formData.get("sourceUrl")),
      excerpt,
      eventDate,
      collectedAt:
        parseDateInput(String(formData.get("collectedAt") || "")) ?? new Date(),
      sourceType: String(formData.get("sourceType") || "other"),
      verificationStatus: String(formData.get("verificationStatus") || "unverified"),
      eventKey,
      isFictional: workspace.isFictional,
      isStale: String(formData.get("verificationStatus") || "") === "stale",
      isResolved: String(formData.get("verificationStatus") || "") === "resolved",
    },
  });

  await recalculateWorkspaceOpportunities(workspace.id);
  revalidatePath("/");
  revalidatePath("/import");
  revalidatePath(`/properties/${propertyId}`);
}

export async function updateEvidenceStatus(formData: FormData) {
  const id = String(formData.get("id") || "");
  const verificationStatus = String(formData.get("verificationStatus") || "");
  await prisma.evidence.update({
    where: { id },
    data: {
      verificationStatus,
      isStale: verificationStatus === "stale",
      isResolved: verificationStatus === "resolved",
    },
  });
  const evidence = await prisma.evidence.findUnique({ where: { id } });
  if (evidence) {
    await recalculateWorkspaceOpportunities(evidence.workspaceId);
  }
  revalidatePath("/");
  return { ok: true };
}

export async function importPropertiesCsv(formData: FormData) {
  const workspace = await getActiveWorkspace();
  if (workspace.mode === "demo") {
    return {
      error:
        "Switch to My workspace or Public-source trial before importing CSV data. Demo stays fictional.",
    };
  }
  const file = formData.get("file");
  if (!(file instanceof File)) return { error: "CSV file is required" };
  const text = await file.text();
  const { rows, errors } = parsePropertyCsv(text);
  if (errors.length && !rows.length) {
    return { error: "Validation failed", errors };
  }

  let created = 0;
  let updated = 0;
  const rowErrors = [...errors];

  for (const row of rows) {
    try {
      const payload = {
        address: row.address,
        suburb: row.suburb,
        propertyType: row.propertyType,
        landAreaSqm: row.landAreaSqm,
        buildingAreaSqm: row.buildingAreaSqm,
        ownerEntity: row.ownerEntity,
        tenant: row.tenant,
        lastSaleDate: row.lastSaleDate ? new Date(row.lastSaleDate) : null,
        leaseExpiry: row.leaseExpiry ? new Date(row.leaseExpiry) : null,
        leaseOptionInfo: row.leaseOptionInfo,
        assignedAgent: row.assignedAgent,
        relationshipNotes: row.relationshipNotes,
        isFictional: false,
      };

      if (row.importKey) {
        const existing = await prisma.property.findUnique({
          where: {
            workspaceId_importKey: {
              workspaceId: workspace.id,
              importKey: row.importKey,
            },
          },
        });
        if (existing) {
          await prisma.property.update({
            where: { id: existing.id },
            data: payload,
          });
          updated += 1;
          continue;
        }
      }

      await prisma.property.create({
        data: {
          ...payload,
          workspaceId: workspace.id,
          importKey: row.importKey,
        },
      });
      created += 1;
    } catch (err) {
      rowErrors.push({
        rowNumber: row.rowNumber,
        messages: [err instanceof Error ? err.message : "Import failed"],
      });
    }
  }

  await recalculateWorkspaceOpportunities(workspace.id);
  revalidatePath("/properties");
  revalidatePath("/");
  return { ok: true, created, updated, errors: rowErrors, previewCount: rows.length };
}

export async function previewPropertiesCsv(formData: FormData) {
  const file = formData.get("file");
  if (!(file instanceof File)) return { error: "CSV file is required" };
  const text = await file.text();
  const parsed = parsePropertyCsv(text);
  return {
    ok: true,
    headers: parsed.headers,
    rows: parsed.rows.slice(0, 20),
    totalRows: parsed.rows.length,
    errors: parsed.errors,
  };
}

export async function updateRule(formData: FormData): Promise<void> {
  const id = String(formData.get("id") || "");
  const enabled = String(formData.get("enabled") || "") === "true";
  const weight = Number(formData.get("weight") || 0);
  const configJson = String(formData.get("configJson") || "{}");
  try {
    JSON.parse(configJson);
  } catch {
    return;
  }
  const rule = await prisma.rule.update({
    where: { id },
    data: { enabled, weight, configJson },
  });
  await recalculateWorkspaceOpportunities(rule.workspaceId);
  revalidatePath("/rules");
  revalidatePath("/");
}

export async function recalculateNow(): Promise<void> {
  const workspace = await getActiveWorkspace();
  await recalculateWorkspaceOpportunities(workspace.id);
  revalidatePath("/");
}

export async function runAiAssist(opportunityId: string) {
  if (!isAiConfigured()) {
    return { error: "AI is not configured. Core app works without it." };
  }
  const opportunity = await prisma.opportunity.findUnique({
    where: { id: opportunityId },
    include: {
      property: true,
      evidence: { include: { evidence: true } },
    },
  });
  if (!opportunity) return { error: "Opportunity not found" };

  const result = await generateAiAssist({
    propertyAddress: opportunity.property.address,
    suburb: opportunity.property.suburb,
    whyNow: opportunity.whyNow,
    missingInfo: opportunity.missingInfo?.split(" | ").filter(Boolean) ?? [],
    evidence: opportunity.evidence.map((link) => ({
      id: link.evidence.id,
      signalCategory: link.evidence.signalCategory,
      sourceTitle: link.evidence.sourceTitle,
      excerpt: link.evidence.excerpt,
      eventDate: link.evidence.eventDate?.toISOString().slice(0, 10) ?? null,
      verificationStatus: link.evidence.verificationStatus,
    })),
  });

  if ("error" in result) return result;

  await prisma.opportunity.update({
    where: { id: opportunityId },
    data: {
      aiSummary: JSON.stringify(result),
      suggestedAction: result.suggestedNextAction || opportunity.suggestedAction,
    },
  });
  revalidatePath(`/opportunities/${opportunityId}`);
  return { ok: true, result };
}

export async function exportWorkspaceJson() {
  const workspace = await getActiveWorkspace();
  const [properties, evidence, notes, feedback, opportunities, rules] =
    await Promise.all([
      prisma.property.findMany({ where: { workspaceId: workspace.id } }),
      prisma.evidence.findMany({ where: { workspaceId: workspace.id } }),
      prisma.note.findMany({ where: { workspaceId: workspace.id } }),
      prisma.feedback.findMany({ where: { workspaceId: workspace.id } }),
      prisma.opportunity.findMany({
        where: { workspaceId: workspace.id },
        include: { rules: true, evidence: true },
      }),
      prisma.rule.findMany({ where: { workspaceId: workspace.id } }),
    ]);

  return {
    exportedAt: new Date().toISOString(),
    workspace: {
      id: workspace.id,
      name: workspace.name,
      mode: workspace.mode,
      isFictional: workspace.isFictional,
    },
    properties,
    evidence,
    notes,
    feedback,
    opportunities,
    rules,
  };
}

function emptyToNull(value: FormDataEntryValue | null): string | null {
  const s = String(value ?? "").trim();
  if (!s || s.toLowerCase() === "unknown") return null;
  return s;
}

function numOrNull(value: FormDataEntryValue | null): number | null {
  const s = String(value ?? "").trim();
  if (!s) return null;
  const n = Number(s);
  return Number.isNaN(n) ? null : n;
}
