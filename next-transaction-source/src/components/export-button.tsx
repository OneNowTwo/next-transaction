"use client";

import { useTransition } from "react";
import { exportWorkspaceJson } from "@/lib/actions";
import { Button } from "@/components/ui/button";

export function ExportButton() {
  const [pending, startTransition] = useTransition();

  return (
    <Button
      disabled={pending}
      onClick={() => {
        startTransition(async () => {
          const data = await exportWorkspaceJson();
          const blob = new Blob([JSON.stringify(data, null, 2)], {
            type: "application/json",
          });
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = `next-transaction-export-${data.workspace.mode}-${new Date()
            .toISOString()
            .slice(0, 10)}.json`;
          a.click();
          URL.revokeObjectURL(url);
        });
      }}
    >
      {pending ? "Preparing…" : "Download JSON export"}
    </Button>
  );
}
