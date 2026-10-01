import { prisma } from "@/lib/db";
import { getActiveWorkspace } from "@/lib/workspace";
import { updateRule, recalculateNow } from "@/lib/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export default async function RulesPage() {
  const workspace = await getActiveWorkspace();
  const rules = await prisma.rule.findMany({
    where: { workspaceId: workspace.id },
    orderBy: { name: "asc" },
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-heading text-2xl font-semibold tracking-tight">
            Opportunity rules
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Transparent, editable rules generate opportunities. Long ownership
            alone never creates a high-priority sale lead. Duplicate event keys
            are not counted twice.
          </p>
        </div>
        <form action={recalculateNow}>
          <Button type="submit" variant="outline" size="sm">
            Recalculate now
          </Button>
        </form>
      </div>

      <div className="grid gap-3">
        {rules.map((rule) => (
          <Card key={rule.id}>
            <CardHeader>
              <CardTitle className="text-lg">{rule.name}</CardTitle>
              <p className="text-sm text-muted-foreground">{rule.description}</p>
            </CardHeader>
            <CardContent>
              <form action={updateRule} className="grid gap-3 sm:grid-cols-3">
                <input type="hidden" name="id" value={rule.id} />
                <div>
                  <Label>Enabled</Label>
                  <select
                    name="enabled"
                    defaultValue={rule.enabled ? "true" : "false"}
                    className="mt-1 flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                  >
                    <option value="true">Enabled</option>
                    <option value="false">Disabled</option>
                  </select>
                </div>
                <div>
                  <Label htmlFor={`weight-${rule.id}`}>Weight</Label>
                  <Input
                    id={`weight-${rule.id}`}
                    name="weight"
                    type="number"
                    defaultValue={rule.weight}
                    className="mt-1"
                  />
                </div>
                <div className="sm:col-span-3">
                  <Label htmlFor={`config-${rule.id}`}>Config JSON</Label>
                  <Textarea
                    id={`config-${rule.id}`}
                    name="configJson"
                    defaultValue={rule.configJson}
                    className="mt-1 font-mono text-xs"
                    rows={3}
                  />
                </div>
                <div className="text-xs text-muted-foreground sm:col-span-2">
                  Key: {rule.key} · Targets: {rule.opportunityType}
                </div>
                <div className="sm:justify-self-end">
                  <Button type="submit" size="sm">
                    Save rule
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
