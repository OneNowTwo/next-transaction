import Papa from "papaparse";
import { z } from "zod";

export const PROPERTY_CSV_HEADERS = [
  "address",
  "suburb",
  "propertyType",
  "landAreaSqm",
  "buildingAreaSqm",
  "ownerEntity",
  "tenant",
  "lastSaleDate",
  "leaseExpiry",
  "leaseOptionInfo",
  "assignedAgent",
  "relationshipNotes",
  "importKey",
] as const;

export const propertyCsvTemplate = `${PROPERTY_CSV_HEADERS.join(",")}
12 Example Street,Eastern Creek,Industrial,10000,7000,Example Owner Pty Ltd,Example Tenant,2018-06-01,2026-12-31,1 x 5yr option,Sam Rivera,Met at PCA,ex-001
`;

const optionalString = z
  .string()
  .optional()
  .transform((v) => {
    if (!v || !v.trim() || v.trim().toLowerCase() === "unknown") return null;
    return v.trim();
  });

const optionalNumber = z
  .string()
  .optional()
  .transform((v, ctx) => {
    if (!v || !v.trim()) return null;
    const n = Number(v);
    if (Number.isNaN(n)) {
      ctx.addIssue({ code: "custom", message: "Must be a number" });
      return z.NEVER;
    }
    return n;
  });

const optionalDate = z
  .string()
  .optional()
  .transform((v, ctx) => {
    if (!v || !v.trim()) return null;
    const d = new Date(v);
    if (Number.isNaN(d.getTime())) {
      ctx.addIssue({ code: "custom", message: "Invalid date (use YYYY-MM-DD)" });
      return z.NEVER;
    }
    return d.toISOString().slice(0, 10);
  });

const rowSchema = z.object({
  address: z.string().min(1, "Address is required"),
  suburb: z.string().min(1, "Suburb is required"),
  propertyType: z.string().optional().transform((v) => v?.trim() || "Industrial"),
  landAreaSqm: optionalNumber,
  buildingAreaSqm: optionalNumber,
  ownerEntity: optionalString,
  tenant: optionalString,
  lastSaleDate: optionalDate,
  leaseExpiry: optionalDate,
  leaseOptionInfo: optionalString,
  assignedAgent: optionalString,
  relationshipNotes: optionalString,
  importKey: optionalString,
});

export type ParsedPropertyRow = z.infer<typeof rowSchema> & { rowNumber: number };
export type RowError = { rowNumber: number; messages: string[] };

export function parsePropertyCsv(text: string): {
  rows: ParsedPropertyRow[];
  errors: RowError[];
  headers: string[];
} {
  const parsed = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim(),
  });

  const headers = parsed.meta.fields ?? [];
  const rows: ParsedPropertyRow[] = [];
  const errors: RowError[] = [];

  const required = ["address", "suburb"];
  for (const req of required) {
    if (!headers.includes(req)) {
      errors.push({
        rowNumber: 0,
        messages: [`Missing required column: ${req}`],
      });
    }
  }
  if (errors.some((e) => e.rowNumber === 0)) {
    return { rows, errors, headers };
  }

  const seenKeys = new Set<string>();
  parsed.data.forEach((raw, index) => {
    const rowNumber = index + 2; // header is row 1
    const result = rowSchema.safeParse(raw);
    if (!result.success) {
      errors.push({
        rowNumber,
        messages: result.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`),
      });
      return;
    }
    const row = result.data;
    if (row.importKey) {
      if (seenKeys.has(row.importKey)) {
        errors.push({
          rowNumber,
          messages: [`Duplicate importKey in file: ${row.importKey}`],
        });
        return;
      }
      seenKeys.add(row.importKey);
    }
    rows.push({ ...row, rowNumber });
  });

  return { rows, errors, headers };
}
