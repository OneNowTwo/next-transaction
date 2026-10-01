import { redirect } from "next/navigation";
import { createSession, isAuthConfigured, verifyLogin } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

async function loginAction(formData: FormData) {
  "use server";
  const email = String(formData.get("email") || "");
  const password = String(formData.get("password") || "");
  const next = String(formData.get("next") || "/");
  const user = await verifyLogin(email, password);
  if (!user) {
    redirect(`/login?error=1&next=${encodeURIComponent(next)}`);
  }
  await createSession(user);
  redirect(next || "/");
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string }>;
}) {
  const params = await searchParams;
  const configured = isAuthConfigured();

  return (
    <div className="flex min-h-full items-center justify-center bg-[radial-gradient(circle_at_top,_#f4f7fb,_#e8edf2)] p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Next Transaction — pilot login</CardTitle>
          <p className="text-sm text-muted-foreground">
            Authentication is required before exposing agency information on a
            hosted deployment. Credentials stay on the server.
          </p>
        </CardHeader>
        <CardContent>
          {!configured ? (
            <p className="text-sm text-amber-900">
              Auth is not configured in this environment (`AUTH_EMAIL` /
              `AUTH_PASSWORD` missing). The temporary preview remains open
              locally — set those env vars for hosted access control.
            </p>
          ) : (
            <form action={loginAction} className="space-y-3">
              <input type="hidden" name="next" value={params.next || "/"} />
              {params.error ? (
                <p className="text-sm text-red-700">Invalid email or password.</p>
              ) : null}
              <div>
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  required
                  className="mt-1"
                  autoComplete="username"
                />
              </div>
              <div>
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  required
                  className="mt-1"
                  autoComplete="current-password"
                />
              </div>
              <Button type="submit" className="w-full">
                Sign in
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
