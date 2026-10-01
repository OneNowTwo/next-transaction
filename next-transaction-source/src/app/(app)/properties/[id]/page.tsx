import Link from "next/link";
import { notFound } from "next/navigation";
import { format } from "date-fns";
import { prisma } from "@/lib/db";
import { addNote, upsertProperty } from "@/lib/actions";
import { unknownOr, formatLabel, SIGNAL_CATEGORY_COPY, type SignalCategory } from "@/lib/constants";
import { FictionalBadge, TypeBadge, PriorityBadge, StatusBadge } from "@/components/badges";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export default async function PropertyDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const property = await prisma.property.findUnique({
    where: { id },
    include: {
      evidence: { orderBy: { collectedAt: "desc" } },
      opportunities: { orderBy: { score: "desc" } },
      notes: { orderBy: { createdAt: "desc" } },
    },
  });
  if (!property) notFound();

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-muted-foreground">
          <Link href="/properties" className="hover:underline">
            Properties
          </Link>{" "}
          / detail
        </p>
        <h2 className="mt-1 font-heading text-3xl font-semibold tracking-tight">
          {property.address}
        </h2>
        <p className="text-muted-foreground">{property.suburb}</p>
        {property.isFictional ? (
          <div className="mt-2">
            <FictionalBadge />
          </div>
        ) : null}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Edit property</CardTitle>
          </CardHeader>
          <CardContent>
            <form action={upsertProperty} className="grid gap-3 sm:grid-cols-2">
              <input type="hidden" name="id" value={property.id} />
              <Field name="address" label="Address" defaultValue={property.address} required />
              <Field name="suburb" label="Suburb" defaultValue={property.suburb} required />
              <Field
                name="propertyType"
                label="Property type"
                defaultValue={property.propertyType}
              />
              <Field
                name="landAreaSqm"
                label="Land area"
                defaultValue={property.landAreaSqm?.toString() ?? ""}
              />
              <Field
                name="buildingAreaSqm"
                label="Building area"
                defaultValue={property.buildingAreaSqm?.toString() ?? ""}
              />
              <Field
                name="ownerEntity"
                label="Owner entity"
                defaultValue={property.ownerEntity ?? ""}
              />
              <Field name="tenant" label="Tenant" defaultValue={property.tenant ?? ""} />
              <Field
                name="lastSaleDate"
                label="Last sale"
                type="date"
                defaultValue={dateInput(property.lastSaleDate)}
              />
              <Field
                name="leaseExpiry"
                label="Lease expiry"
                type="date"
                defaultValue={dateInput(property.leaseExpiry)}
              />
              <Field
                name="leaseOptionInfo"
                label="Option info"
                defaultValue={property.leaseOptionInfo ?? ""}
              />
              <Field
                name="leaseVerifiedAt"
                label="Lease verified"
                type="date"
                defaultValue={dateInput(property.leaseVerifiedAt)}
              />
              <Field
                name="assignedAgent"
                label="Assigned agent"
                defaultValue={property.assignedAgent ?? ""}
              />
              <div className="sm:col-span-2">
                <Label htmlFor="relationshipNotes">Relationship notes</Label>
                <Textarea
                  id="relationshipNotes"
                  name="relationshipNotes"
                  className="mt-1"
                  defaultValue={property.relationshipNotes ?? ""}
                />
              </div>
              <div className="sm:col-span-2">
                <Button type="submit">Update property</Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Snapshot</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <Row label="Owner" value={unknownOr(property.ownerEntity)} />
            <Row label="Tenant" value={unknownOr(property.tenant)} />
            <Row
              label="Lease expiry"
              value={
                property.leaseExpiry
                  ? format(property.leaseExpiry, "dd MMM yyyy")
                  : "Unknown"
              }
            />
            <Row label="Option" value={unknownOr(property.leaseOptionInfo)} />
            <Row
              label="Last sale"
              value={
                property.lastSaleDate
                  ? format(property.lastSaleDate, "dd MMM yyyy")
                  : "Unknown"
              }
            />
            <Row
              label="Building"
              value={unknownOr(property.buildingAreaSqm, " sqm")}
            />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Related opportunities</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {property.opportunities.length === 0 ? (
            <p className="text-sm text-muted-foreground">None yet.</p>
          ) : (
            property.opportunities.map((o) => (
              <Link
                key={o.id}
                href={`/opportunities/${o.id}`}
                className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border px-3 py-2 text-sm hover:bg-muted/40"
              >
                <span className="font-medium capitalize">{o.type}</span>
                <div className="flex gap-1.5">
                  <TypeBadge value={o.type} />
                  <PriorityBadge value={o.priority} />
                  <StatusBadge value={o.status} />
                </div>
              </Link>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Related evidence</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {property.evidence.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No evidence yet. Add some on the Import & Evidence page.
            </p>
          ) : (
            property.evidence.map((e) => (
              <div key={e.id} className="rounded-md border border-border px-3 py-2 text-sm">
                <p className="font-medium">{e.sourceTitle}</p>
                <p className="text-xs text-muted-foreground">
                  {SIGNAL_CATEGORY_COPY[e.signalCategory as SignalCategory] ??
                    formatLabel(e.signalCategory)}{" "}
                  · {formatLabel(e.verificationStatus)}
                </p>
                <p className="mt-1">{e.excerpt}</p>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Notes</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <form action={addNote} className="space-y-2">
            <input type="hidden" name="propertyId" value={property.id} />
            <Textarea name="body" required placeholder="Relationship or research note…" />
            <Button type="submit" size="sm">
              Add note
            </Button>
          </form>
          {property.notes.map((n) => (
            <div key={n.id} className="rounded-md border border-border px-3 py-2 text-sm">
              {n.body}
              <p className="mt-1 text-xs text-muted-foreground">
                {format(n.createdAt, "dd MMM yyyy HH:mm")}
              </p>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function Field(props: {
  name: string;
  label: string;
  defaultValue?: string;
  required?: boolean;
  type?: string;
}) {
  return (
    <div>
      <Label htmlFor={props.name}>{props.label}</Label>
      <Input
        id={props.name}
        name={props.name}
        type={props.type ?? "text"}
        defaultValue={props.defaultValue}
        required={props.required}
        className="mt-1"
      />
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3 border-b border-border/70 py-1.5">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{value}</span>
    </div>
  );
}

function dateInput(value: Date | null): string {
  return value ? value.toISOString().slice(0, 10) : "";
}
