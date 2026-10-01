import { prisma } from "@/lib/db";
import { normalizeAddressKey, parseAustralianAddress } from "@/lib/geo";

export type MatchResult =
  | { status: "matched"; propertyId: string; confidence: "high" }
  | { status: "review"; reason: string; candidatePropertyId?: string }
  | { status: "unmatched"; reason: string };

export async function matchIngestedToProperty(input: {
  workspaceId: string;
  addressRaw?: string | null;
  suburb?: string | null;
  councilRef?: string | null;
  companySymbol?: string | null;
  requireAddress?: boolean;
}): Promise<MatchResult> {
  const requireAddress = input.requireAddress ?? true;

  if (input.councilRef) {
    const byImport = await prisma.property.findFirst({
      where: {
        workspaceId: input.workspaceId,
        importKey: input.councilRef,
      },
    });
    if (byImport) {
      return { status: "matched", propertyId: byImport.id, confidence: "high" };
    }
  }

  if (!input.addressRaw) {
    if (input.companySymbol) {
      return {
        status: "review",
        reason:
          "Company announcement has no explicit property address — do not attach to a warehouse without linking evidence.",
      };
    }
    return {
      status: "unmatched",
      reason: "No address or council reference available for matching.",
    };
  }

  const parsed = parseAustralianAddress(input.addressRaw);
  const street = parsed.address;
  const suburb = input.suburb || parsed.suburb;
  const key = normalizeAddressKey(street, suburb);

  const properties = await prisma.property.findMany({
    where: {
      workspaceId: input.workspaceId,
      ...(suburb ? { suburb: { equals: suburb } } : {}),
    },
  });

  const exact = properties.find(
    (p) => normalizeAddressKey(p.address, p.suburb) === key
  );
  if (exact) {
    return { status: "matched", propertyId: exact.id, confidence: "high" };
  }

  // Soft candidate: same suburb and street number
  const number = street.match(/^(\d+[A-Za-z]?)/)?.[1];
  const candidates = properties.filter((p) => {
    if (suburb && p.suburb.toLowerCase() !== suburb.toLowerCase()) return false;
    if (!number) return false;
    return p.address.trim().toLowerCase().startsWith(number.toLowerCase());
  });

  if (candidates.length === 1) {
    return {
      status: "review",
      reason: `Possible address match to ${candidates[0].address}, ${candidates[0].suburb} — confirm before linking.`,
      candidatePropertyId: candidates[0].id,
    };
  }
  if (candidates.length > 1) {
    return {
      status: "review",
      reason: `Multiple possible property matches for "${input.addressRaw}".`,
    };
  }

  if (requireAddress) {
    // Will create a new property shell for high-confidence planning addresses in pipeline
    return {
      status: "unmatched",
      reason: "No existing property match — may create a new live property shell from planning address.",
    };
  }

  return { status: "unmatched", reason: "No property match." };
}
