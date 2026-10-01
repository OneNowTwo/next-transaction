import { cookies } from "next/headers";
import { prisma } from "@/lib/db";
import { DEFAULT_RULES } from "@/lib/rules";
import { WORKSPACE_COOKIE } from "@/lib/constants";

async function ensureRules(workspaceId: string) {
  for (const rule of DEFAULT_RULES) {
    try {
      await prisma.rule.upsert({
        where: { workspaceId_key: { workspaceId, key: rule.key } },
        create: { workspaceId, ...rule, enabled: true },
        update: {},
      });
    } catch (err) {
      // Concurrent request-time bootstrap can race on the unique key; safe to ignore.
      const code =
        err && typeof err === "object" && "code" in err
          ? String((err as { code?: string }).code)
          : "";
      if (code !== "P2002") throw err;
    }
  }
}

export async function ensureWorkspaces() {
  let demo = await prisma.workspace.findFirst({ where: { mode: "demo" } });
  let real = await prisma.workspace.findFirst({ where: { mode: "real" } });
  let trial = await prisma.workspace.findFirst({ where: { mode: "trial" } });
  let live = await prisma.workspace.findFirst({ where: { mode: "live" } });

  if (!real) {
    real = await prisma.workspace.create({
      data: { name: "My Workspace", mode: "real", isFictional: false },
    });
  }
  if (!demo) {
    demo = await prisma.workspace.create({
      data: { name: "Western Sydney Demo", mode: "demo", isFictional: true },
    });
  }
  if (!trial) {
    trial = await prisma.workspace.create({
      data: {
        name: "Public-source trial",
        mode: "trial",
        isFictional: false,
      },
    });
  }
  if (!live) {
    live = await prisma.workspace.create({
      data: { name: "Live pilot", mode: "live", isFictional: false },
    });
  }

  await ensureRules(demo.id);
  await ensureRules(real.id);
  await ensureRules(trial.id);
  await ensureRules(live.id);

  return { demo, real, trial, live };
}

export async function getActiveWorkspace() {
  const { demo, live } = await ensureWorkspaces();
  const jar = await cookies();
  const id = jar.get(WORKSPACE_COOKIE)?.value;
  if (id) {
    const found = await prisma.workspace.findUnique({ where: { id } });
    if (found) {
      // An unseeded demo/trial looks blank on a fresh host. Land on Live instead.
      if (found.mode === "demo" || found.mode === "trial") {
        const count = await prisma.property.count({ where: { workspaceId: found.id } });
        if (count === 0) return live;
      }
      return found;
    }
  }
  const demoCount = await prisma.property.count({ where: { workspaceId: demo.id } });
  if (demoCount === 0) return live;
  return demo;
}

export async function setActiveWorkspaceId(id: string) {
  const jar = await cookies();
  jar.set(WORKSPACE_COOKIE, id, { path: "/", httpOnly: false, sameSite: "lax" });
}

export type WorkspaceMode = "demo" | "real" | "trial" | "live";
