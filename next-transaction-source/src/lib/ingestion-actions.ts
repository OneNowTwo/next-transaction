"use server";

import { revalidatePath } from "next/cache";
import { runAllConnectors, runConnector } from "@/lib/ingestion/pipeline";
import { prisma } from "@/lib/db";
import { getActiveWorkspace } from "@/lib/workspace";
import { recalculateWorkspaceOpportunities } from "@/lib/rules";

export async function runIngestionAction(key: string) {
  if (key === "all") {
    await runAllConnectors();
  } else {
    await runConnector(key);
  }
  revalidatePath("/sources");
  revalidatePath("/review");
  revalidatePath("/");
  revalidatePath("/properties");
}

export async function resolveMatchReview(formData: FormData) {
  const id = String(formData.get("id") || "");
  const action = String(formData.get("action") || "");
  const review = await prisma.matchReview.findUnique({
    where: { id },
    include: { record: true },
  });
  if (!review) return;

  if (action === "dismiss") {
    await prisma.matchReview.update({
      where: { id },
      data: { status: "dismissed" },
    });
    await prisma.ingestedRecord.update({
      where: { id: review.ingestedRecordId },
      data: { matchStatus: "skipped" },
    });
  } else if (action === "link_candidate" && review.candidatePropertyId) {
    const workspace = await getActiveWorkspace();
    const record = review.record;
    const evidence = await prisma.evidence.create({
      data: {
        workspaceId: workspace.id,
        propertyId: review.candidatePropertyId,
        signalCategory: record.signalHint || "other",
        sourceTitle: record.title,
        sourceUrl: record.sourceUrl,
        excerpt: record.excerpt,
        eventDate: record.eventDate,
        sourceType:
          record.companySymbol != null ? "company_announcement" : "planning",
        verificationStatus: "unverified",
        eventKey: `review-${record.dedupeKey}`,
        isFictional: false,
      },
    });
    await prisma.ingestedRecord.update({
      where: { id: record.id },
      data: {
        matchStatus: "matched",
        propertyId: review.candidatePropertyId,
        evidenceId: evidence.id,
      },
    });
    await prisma.matchReview.update({
      where: { id },
      data: { status: "linked" },
    });
    await recalculateWorkspaceOpportunities(workspace.id);
  }

  revalidatePath("/review");
  revalidatePath("/sources");
  revalidatePath("/");
}
