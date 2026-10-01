"use client";

import { useState, useTransition } from "react";
import { importPropertiesCsv, previewPropertiesCsv } from "@/lib/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Preview = {
  headers?: string[];
  rows?: Array<Record<string, unknown>>;
  totalRows?: number;
  errors?: Array<{ rowNumber: number; messages: string[] }>;
  error?: string;
};

type ImportResult = {
  ok?: boolean;
  created?: number;
  updated?: number;
  errors?: Array<{ rowNumber: number; messages: string[] }>;
  error?: string;
};

export function ImportForm({ disabled }: { disabled?: boolean }) {
  const [preview, setPreview] = useState<Preview | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <div className="space-y-4">
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          const form = e.currentTarget;
          const fd = new FormData(form);
          startTransition(async () => {
            const data = await previewPropertiesCsv(fd);
            setPreview(data as Preview);
            setResult(null);
          });
        }}
      >
        <Input name="file" type="file" accept=".csv,text/csv" required disabled={disabled} />
        <div className="flex flex-wrap gap-2">
          <Button type="submit" variant="secondary" disabled={disabled || pending}>
            Preview & validate
          </Button>
          <Button
            type="button"
            disabled={disabled || pending || !preview?.rows?.length}
            onClick={() => {
              const input = document.querySelector<HTMLInputElement>(
                'input[name="file"]'
              );
              if (!input?.files?.[0]) return;
              const fd = new FormData();
              fd.set("file", input.files[0]);
              startTransition(async () => {
                const data = (await importPropertiesCsv(fd)) as ImportResult;
                setResult(data);
              });
            }}
          >
            Save import
          </Button>
        </div>
      </form>

      {preview?.error ? (
        <p className="text-sm text-red-700">{preview.error}</p>
      ) : null}

      {preview?.errors?.length ? (
        <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm">
          <p className="font-medium">Validation issues</p>
          <ul className="mt-1 list-disc pl-5">
            {preview.errors.map((err, i) => (
              <li key={`${err.rowNumber}-${i}`}>
                Row {err.rowNumber || "headers"}: {err.messages.join("; ")}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {preview?.rows?.length ? (
        <div className="overflow-x-auto rounded-md border border-border">
          <p className="border-b border-border px-3 py-2 text-sm text-muted-foreground">
            Previewing {preview.rows.length} of {preview.totalRows} valid rows
          </p>
          <table className="min-w-full text-left text-sm">
            <thead className="bg-muted/50">
              <tr>
                {(preview.headers ?? []).slice(0, 6).map((h) => (
                  <th key={h} className="px-3 py-2 font-medium">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {preview.rows.map((row, idx) => (
                <tr key={idx} className="border-t border-border">
                  {(preview.headers ?? []).slice(0, 6).map((h) => (
                    <td key={h} className="px-3 py-2">
                      {String((row as Record<string, unknown>)[h] ?? "")}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {result?.ok ? (
        <p className="text-sm text-emerald-800">
          Imported {result.created ?? 0} new, updated {result.updated ?? 0}.
          {result.errors?.length
            ? ` ${result.errors.length} row(s) had issues.`
            : ""}
        </p>
      ) : null}
      {result?.error ? (
        <p className="text-sm text-red-700">{result.error}</p>
      ) : null}
    </div>
  );
}
