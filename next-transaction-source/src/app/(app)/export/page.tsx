import { ExportButton } from "@/components/export-button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function ExportPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-heading text-2xl font-semibold tracking-tight">
          Export records
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Download the active workspace as JSON: properties, evidence, notes,
          feedback, opportunities and rules. Data persists in local SQLite across
          restarts.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Workspace export</CardTitle>
        </CardHeader>
        <CardContent>
          <ExportButton />
        </CardContent>
      </Card>
    </div>
  );
}
