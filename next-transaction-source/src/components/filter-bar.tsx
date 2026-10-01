"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

export function FilterBar({
  suburbs,
  filters,
}: {
  suburbs: string[];
  filters: {
    suburb?: string;
    type?: string;
    priority?: string;
    status?: string;
    q?: string;
  };
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function update(key: string, value: string) {
    const params = new URLSearchParams();
    const next = { ...filters, [key]: value || undefined };
    Object.entries(next).forEach(([k, v]) => {
      if (v) params.set(k, v);
    });
    startTransition(() => {
      router.push(`/?${params.toString()}`);
    });
  }

  return (
    <div className="grid gap-2 rounded-lg border border-border bg-card p-3 sm:grid-cols-2 lg:grid-cols-5">
      <input
        className="h-9 rounded-md border border-input bg-background px-3 text-sm"
        placeholder="Search address…"
        defaultValue={filters.q ?? ""}
        onChange={(e) => update("q", e.target.value)}
        disabled={pending}
      />
      <select
        className="h-9 rounded-md border border-input bg-background px-3 text-sm"
        value={filters.suburb ?? ""}
        onChange={(e) => update("suburb", e.target.value)}
      >
        <option value="">All suburbs</option>
        {suburbs.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </select>
      <select
        className="h-9 rounded-md border border-input bg-background px-3 text-sm"
        value={filters.type ?? ""}
        onChange={(e) => update("type", e.target.value)}
      >
        <option value="">All types</option>
        <option value="sale">Sale</option>
        <option value="leasing">Leasing</option>
      </select>
      <select
        className="h-9 rounded-md border border-input bg-background px-3 text-sm"
        value={filters.priority ?? ""}
        onChange={(e) => update("priority", e.target.value)}
      >
        <option value="">All priorities</option>
        <option value="high">High</option>
        <option value="medium">Medium</option>
        <option value="low">Low</option>
      </select>
      <select
        className="h-9 rounded-md border border-input bg-background px-3 text-sm"
        value={filters.status ?? ""}
        onChange={(e) => update("status", e.target.value)}
      >
        <option value="">All statuses</option>
        <option value="new">New</option>
        <option value="saved">Saved</option>
        <option value="investigating">Investigating</option>
        <option value="contacted">Contacted</option>
        <option value="dismissed">Dismissed</option>
      </select>
    </div>
  );
}
