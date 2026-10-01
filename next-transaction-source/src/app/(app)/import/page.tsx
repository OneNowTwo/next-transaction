import Link from "next/link";
import { prisma } from "@/lib/db";
import { getActiveWorkspace } from "@/lib/workspace";
import { addEvidence } from "@/lib/actions";
import { propertyCsvTemplate } from "@/lib/csv";
import {
  SIGNAL_CATEGORIES,
  SOURCE_TYPES,
  VERIFICATION_STATUSES,
  SIGNAL_CATEGORY_COPY,
  formatLabel,
} from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ImportForm } from "@/components/import-form";

export default async function ImportPage() {
  const workspace = await getActiveWorkspace();
  const properties = await prisma.property.findMany({
    where: { workspaceId: workspace.id },
    orderBy: [{ suburb: "asc" }, { address: "asc" }],
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-heading text-2xl font-semibold tracking-tight">
          Import & evidence
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Users supply evidence. A URL is a reference unless its contents have
          actually been retrieved.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>CSV property import</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <a
              href={`data:text/csv;charset=utf-8,${encodeURIComponent(propertyCsvTemplate)}`}
              download="next-transaction-property-template.csv"
              className="inline-flex h-8 items-center rounded-md border border-border px-3 text-sm hover:bg-muted"
            >
              Download CSV template
            </a>
            {workspace.mode === "demo" ? (
              <p className="text-sm text-amber-800">
                Switch to <strong>My workspace</strong> or{" "}
                <strong>Public-source trial</strong> to import CSV data. Demo
                stays fictional.
              </p>
            ) : null}
            {workspace.mode === "trial" ? (
              <p className="text-sm text-teal-800">
                Trial imports stay in the public-source workspace only — not
                mixed into demo or personal agency records.
              </p>
            ) : null}
          </div>
          <ImportForm disabled={workspace.mode === "demo"} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Manual evidence entry</CardTitle>
        </CardHeader>
        <CardContent>
          {properties.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Add or import a property first.{" "}
              <Link href="/properties" className="underline">
                Open property register
              </Link>
            </p>
          ) : (
            <form action={addEvidence} className="grid gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Label htmlFor="propertyId">Related property</Label>
                <select
                  id="propertyId"
                  name="propertyId"
                  required
                  className="mt-1 flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="">Select property…</option>
                  {properties.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.address}, {p.suburb}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Label htmlFor="signalCategory">Signal category</Label>
                <select
                  id="signalCategory"
                  name="signalCategory"
                  className="mt-1 flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                  defaultValue="lease_expiry"
                >
                  {SIGNAL_CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {SIGNAL_CATEGORY_COPY[c]}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Label htmlFor="sourceType">Source type</Label>
                <select
                  id="sourceType"
                  name="sourceType"
                  className="mt-1 flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                  defaultValue="agent_note"
                >
                  {SOURCE_TYPES.map((c) => (
                    <option key={c} value={c}>
                      {formatLabel(c)}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Label htmlFor="sourceTitle">Source title</Label>
                <Input id="sourceTitle" name="sourceTitle" required className="mt-1" />
              </div>
              <div>
                <Label htmlFor="sourceUrl">Source URL (optional reference)</Label>
                <Input id="sourceUrl" name="sourceUrl" className="mt-1" />
              </div>
              <div>
                <Label htmlFor="eventDate">Event date</Label>
                <Input id="eventDate" name="eventDate" type="date" className="mt-1" />
              </div>
              <div>
                <Label htmlFor="collectedAt">Date collected</Label>
                <Input id="collectedAt" name="collectedAt" type="date" className="mt-1" />
              </div>
              <div>
                <Label htmlFor="verificationStatus">Verification status</Label>
                <select
                  id="verificationStatus"
                  name="verificationStatus"
                  className="mt-1 flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                  defaultValue="unverified"
                >
                  {VERIFICATION_STATUSES.map((c) => (
                    <option key={c} value={c}>
                      {formatLabel(c)}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Label htmlFor="eventKey">Event key (for duplicate detection)</Label>
                <Input
                  id="eventKey"
                  name="eventKey"
                  className="mt-1"
                  placeholder="Optional stable event id"
                />
              </div>
              <div className="sm:col-span-2">
                <Label htmlFor="excerpt">Excerpt / note</Label>
                <Textarea id="excerpt" name="excerpt" required className="mt-1" />
              </div>
              <div className="sm:col-span-2">
                <Button type="submit">Save evidence & recalculate</Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
