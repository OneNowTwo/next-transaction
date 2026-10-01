import Link from "next/link";
import { format } from "date-fns";
import { prisma } from "@/lib/db";
import { getActiveWorkspace } from "@/lib/workspace";
import { upsertProperty } from "@/lib/actions";
import { unknownOr } from "@/lib/constants";
import { FictionalBadge } from "@/components/badges";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default async function PropertiesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const workspace = await getActiveWorkspace();
  const properties = await prisma.property.findMany({
    where: {
      workspaceId: workspace.id,
      ...(q
        ? {
            OR: [
              { address: { contains: q } },
              { suburb: { contains: q } },
              { ownerEntity: { contains: q } },
              { tenant: { contains: q } },
            ],
          }
        : {}),
    },
    include: {
      _count: { select: { evidence: true, opportunities: true } },
    },
    orderBy: [{ suburb: "asc" }, { address: "asc" }],
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-heading text-2xl font-semibold tracking-tight">
          Property register
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Search, add and inspect properties. Missing values stay Unknown.
        </p>
      </div>

      <form className="flex gap-2">
        <Input name="q" placeholder="Search address, suburb, owner, tenant…" defaultValue={q ?? ""} />
        <Button type="submit" variant="secondary">
          Search
        </Button>
      </form>

      <Card>
        <CardHeader>
          <CardTitle>Add property</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={upsertProperty} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Field name="address" label="Address" required />
            <Field name="suburb" label="Suburb" required />
            <Field name="propertyType" label="Property type" defaultValue="Industrial" />
            <Field name="landAreaSqm" label="Land area (sqm)" />
            <Field name="buildingAreaSqm" label="Building area (sqm)" />
            <Field name="ownerEntity" label="Owner entity" />
            <Field name="tenant" label="Tenant" />
            <Field name="lastSaleDate" label="Last sale date" type="date" />
            <Field name="leaseExpiry" label="Lease expiry" type="date" />
            <Field name="leaseOptionInfo" label="Option information" />
            <Field name="leaseVerifiedAt" label="Lease verified date" type="date" />
            <Field name="assignedAgent" label="Assigned agent" />
            <div className="sm:col-span-2 lg:col-span-3">
              <Label htmlFor="relationshipNotes">Relationship notes</Label>
              <Textarea id="relationshipNotes" name="relationshipNotes" className="mt-1" />
            </div>
            <div className="sm:col-span-2 lg:col-span-3">
              <Button type="submit">Save property</Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {properties.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-card/60 px-6 py-12 text-center text-sm text-muted-foreground">
          No properties in this workspace yet.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Address</TableHead>
                <TableHead>Suburb</TableHead>
                <TableHead>Owner</TableHead>
                <TableHead>Tenant</TableHead>
                <TableHead>Lease expiry</TableHead>
                <TableHead>Evidence</TableHead>
                <TableHead>Opps</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {properties.map((p) => (
                <TableRow key={p.id}>
                  <TableCell>
                    <Link
                      href={`/properties/${p.id}`}
                      className="font-medium underline-offset-2 hover:underline"
                    >
                      {p.address}
                    </Link>
                    {p.isFictional ? (
                      <div className="mt-1">
                        <FictionalBadge />
                      </div>
                    ) : null}
                  </TableCell>
                  <TableCell>{p.suburb}</TableCell>
                  <TableCell>{unknownOr(p.ownerEntity)}</TableCell>
                  <TableCell>{unknownOr(p.tenant)}</TableCell>
                  <TableCell>
                    {p.leaseExpiry ? format(p.leaseExpiry, "dd MMM yyyy") : "Unknown"}
                  </TableCell>
                  <TableCell>{p._count.evidence}</TableCell>
                  <TableCell>{p._count.opportunities}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

function Field({
  name,
  label,
  required,
  type = "text",
  defaultValue,
}: {
  name: string;
  label: string;
  required?: boolean;
  type?: string;
  defaultValue?: string;
}) {
  return (
    <div>
      <Label htmlFor={name}>{label}</Label>
      <Input
        id={name}
        name={name}
        type={type}
        required={required}
        defaultValue={defaultValue}
        className="mt-1"
      />
    </div>
  );
}
