import { cookies } from "next/headers";
import { createHmac, timingSafeEqual } from "crypto";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";

const SESSION_COOKIE = "nt_session";
const SESSION_DAYS = 14;

function sessionSecret(): string {
  return (
    process.env.AUTH_SECRET?.trim() ||
    process.env.CRON_SECRET?.trim() ||
    "next-transaction-dev-only-secret-change-me"
  );
}

function sign(payload: string): string {
  return createHmac("sha256", sessionSecret()).update(payload).digest("hex");
}

export type SessionUser = { id: string; email: string; name: string | null };

export function isAuthConfigured(): boolean {
  return Boolean(process.env.AUTH_EMAIL?.trim() && process.env.AUTH_PASSWORD?.trim());
}

export async function ensureBootstrapUser() {
  const email = process.env.AUTH_EMAIL?.trim().toLowerCase();
  const password = process.env.AUTH_PASSWORD?.trim();
  if (!email || !password) return null;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return existing;

  const passwordHash = await bcrypt.hash(password, 10);
  return prisma.user.create({
    data: {
      email,
      passwordHash,
      name: process.env.AUTH_NAME?.trim() || "Pilot Agent",
    },
  });
}

export async function verifyLogin(
  email: string,
  password: string
): Promise<SessionUser | null> {
  await ensureBootstrapUser();
  const user = await prisma.user.findUnique({
    where: { email: email.trim().toLowerCase() },
  });
  if (!user) return null;
  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) return null;
  return { id: user.id, email: user.email, name: user.name };
}

export async function createSession(user: SessionUser) {
  const exp = Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000;
  const body = Buffer.from(
    JSON.stringify({ id: user.id, email: user.email, name: user.name, exp }),
    "utf8"
  ).toString("base64url");
  const token = `${body}.${sign(body)}`;
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: process.env.NODE_ENV === "production",
    expires: new Date(exp),
  });
}

export async function clearSession() {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
}

export async function getSessionUser(): Promise<SessionUser | null> {
  const jar = await cookies();
  const raw = jar.get(SESSION_COOKIE)?.value;
  if (!raw) return null;
  const [body, sig] = raw.split(".");
  if (!body || !sig) return null;
  const expected = sign(body);
  try {
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  } catch {
    return null;
  }
  try {
    const data = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as {
      id: string;
      email: string;
      name: string | null;
      exp: number;
    };
    if (!data.exp || Date.now() > data.exp) return null;
    return { id: data.id, email: data.email, name: data.name };
  } catch {
    return null;
  }
}

export function verifyCronSecret(headerValue: string | null): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return process.env.NODE_ENV !== "production";
  if (!headerValue) return false;
  const provided = headerValue.replace(/^Bearer\s+/i, "").trim();
  try {
    const a = Buffer.from(provided);
    const b = Buffer.from(secret);
    return a.length === b.length && timingSafeEqual(a, b);
  } catch {
    return false;
  }
}
