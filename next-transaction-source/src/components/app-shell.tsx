"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { switchWorkspace } from "@/lib/actions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const links = [
  { href: "/", label: "Opportunities" },
  { href: "/properties", label: "Properties" },
  { href: "/import", label: "Import & Evidence" },
  { href: "/sources", label: "Sources" },
  { href: "/review", label: "Review" },
  { href: "/rules", label: "Rules" },
  { href: "/feedback", label: "Feedback" },
  { href: "/export", label: "Export" },
];

export function AppShell({
  workspaceMode,
  workspaceName,
  isFictional,
  children,
}: {
  workspaceMode: string;
  workspaceName: string;
  isFictional: boolean;
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className="min-h-full bg-[radial-gradient(circle_at_top,_#f4f7fb,_#eef2f6_45%,_#e8edf2)]">
      <header className="border-b border-border bg-card/80 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-4 sm:px-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
                Western Sydney industrial
              </p>
              <h1 className="font-heading text-2xl font-semibold tracking-tight text-foreground">
                Next Transaction
              </h1>
              <p className="text-sm text-muted-foreground">{workspaceName}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {isFictional ? (
                <Badge
                  variant="outline"
                  className="border-amber-300 bg-amber-50 text-amber-900"
                >
                  Fictional demo data
                </Badge>
              ) : null}
              {workspaceMode === "trial" ? (
                <Badge
                  variant="outline"
                  className="border-teal-300 bg-teal-50 text-teal-900"
                >
                  Public-source trial
                </Badge>
              ) : null}
              {workspaceMode === "live" ? (
                <Badge
                  variant="outline"
                  className="border-emerald-300 bg-emerald-50 text-emerald-900"
                >
                  Live retrieved only
                </Badge>
              ) : null}
              <form action={switchWorkspace.bind(null, "live")}>
                <Button
                  type="submit"
                  size="sm"
                  variant={workspaceMode === "live" ? "default" : "outline"}
                >
                  Live pilot
                </Button>
              </form>
              <form action={switchWorkspace.bind(null, "demo")}>
                <Button
                  type="submit"
                  size="sm"
                  variant={workspaceMode === "demo" ? "default" : "outline"}
                >
                  Demo
                </Button>
              </form>
              <form action={switchWorkspace.bind(null, "trial")}>
                <Button
                  type="submit"
                  size="sm"
                  variant={workspaceMode === "trial" ? "default" : "outline"}
                >
                  Public trial
                </Button>
              </form>
              <form action={switchWorkspace.bind(null, "real")}>
                <Button
                  type="submit"
                  size="sm"
                  variant={workspaceMode === "real" ? "default" : "outline"}
                >
                  My workspace
                </Button>
              </form>
            </div>
          </div>
          <nav className="flex flex-wrap gap-1">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "rounded-md px-3 py-1.5 text-sm text-muted-foreground transition hover:bg-muted hover:text-foreground",
                  pathname === link.href && "bg-muted font-medium text-foreground"
                )}
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
      </header>
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6">
        <div className="mb-3 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800">
          Pilot uses <strong>supplied evidence</strong> and{" "}
          <strong>scheduled ingestion</strong> from configured sources. It does
          not invent ownership, lease or tenant details. Temporary cloud previews
          are not permanent hosting.
        </div>
        {workspaceMode === "live" ? (
          <div className="mb-4 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-950">
            <strong>Live pilot</strong> — research leads here come only from
            genuinely retrieved records. Never padded with fiction. Planning ≠
            sale intent; on-market listings stay labelled as such.
          </div>
        ) : null}
        {workspaceMode === "demo" ? (
          <div className="mb-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
            <strong>Demo workspace</strong> — fictional records only, kept
            separate from live ingestion.
          </div>
        ) : null}
        {workspaceMode === "trial" ? (
          <div className="mb-4 rounded-md border border-teal-200 bg-teal-50 px-3 py-2 text-sm text-teal-950">
            <strong>Public-source trial</strong> — manually curated public pages,
            separate from demo and live ingestion.
          </div>
        ) : null}
        {workspaceMode === "real" ? (
          <div className="mb-4 rounded-md border border-sky-200 bg-sky-50 px-3 py-2 text-sm text-sky-950">
            <strong>My workspace</strong> — your CSV/manual evidence. Do not host
            private agency data without authentication.
          </div>
        ) : null}
        {children}
      </main>
    </div>
  );
}
