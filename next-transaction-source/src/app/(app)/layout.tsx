import { AppShell } from "@/components/app-shell";
import { scheduleLiveIngestIfEmpty } from "@/lib/ingestion/bootstrap";
import { getActiveWorkspace } from "@/lib/workspace";

// Always request-time: workspace bootstrap hits the DB and must not race at build.
export const dynamic = "force-dynamic";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  scheduleLiveIngestIfEmpty();
  const workspace = await getActiveWorkspace();

  return (
    <AppShell
      workspaceMode={workspace.mode}
      workspaceName={workspace.name}
      isFictional={workspace.isFictional}
    >
      {children}
    </AppShell>
  );
}
