import { Link, useNavigate } from "@tanstack/react-router";
import { CalendarCheck, KeyRound, LogIn, Mail, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";
import type { FormEvent } from "react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useSessionState } from "@/hooks/use-session-state";
import { supabase } from "@/integrations/supabase/client";

function friendlyAuthError(error: unknown): string {
  const message = error instanceof Error ? error.message : "Something went wrong signing in.";
  if (message.includes("Invalid login credentials")) return "Email or password is incorrect.";
  if (message.includes("Email not confirmed"))
    return "Confirm your email address before signing in.";
  if (message.includes("User not found")) return "No account found for that email address.";
  return message;
}

export function SignInPage() {
  const session = useSessionState();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"password" | "magic-link">("password");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (session.status === "signed-in") {
      void navigate({ to: "/" });
    }
  }, [session.status, navigate]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setNotice(null);
    setSubmitting(true);

    try {
      if (!email.trim()) {
        setError("Enter your email address.");
        return;
      }
      if (mode === "password" && !password) {
        setError("Enter your password.");
        return;
      }

      if (mode === "password") {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (signInError) throw signInError;
        const { data } = await supabase.auth.getSession();
        if (data.session) {
          await navigate({ to: "/" });
          return;
        }
        setError("Signed in, but no session was returned. Try again.");
      } else {
        const { error: signInError } = await supabase.auth.signInWithOtp({
          email: email.trim(),
          options: {
            shouldCreateUser: false,
            emailRedirectTo: window.location.origin,
          },
        });
        if (signInError) throw signInError;
        setNotice("Check your inbox — we sent you a sign-in link.");
      }
    } catch (err) {
      setError(friendlyAuthError(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-6 bg-muted/40 p-4">
      <Link to="/" className="flex items-center gap-2">
        <div className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <Mail className="size-5" />
        </div>
        <div className="flex flex-col leading-none">
          <span className="text-sm font-semibold">Merchant Core</span>
          <span className="text-xs text-muted-foreground">Operator Console</span>
        </div>
      </Link>

      <Card className="w-full max-w-sm">
        <CardHeader className="space-y-1">
          <CardTitle className="text-xl">Sign in</CardTitle>
          <CardDescription>Sign in with a workspace membership to load real data.</CardDescription>
        </CardHeader>

        {session.status === "signed-in" ? (
          <CardContent className="flex flex-col items-center gap-3 py-8">
            <ShieldCheck className="size-10 text-primary" />
            <p className="text-sm text-muted-foreground">
              You are signed in. Opening the dashboard…
            </p>
          </CardContent>
        ) : (
          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-1">
                <button
                  type="button"
                  onClick={() => {
                    setMode("password");
                    setError(null);
                  }}
                  className={`flex items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                    mode === "password"
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <KeyRound className="size-3.5" />
                  Password
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMode("magic-link");
                    setError(null);
                  }}
                  className={`flex items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                    mode === "magic-link"
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Mail className="size-3.5" />
                  Magic link
                </button>
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  placeholder="you@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={submitting}
                  required
                />
              </div>

              {mode === "password" ? (
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    autoComplete="current-password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={submitting}
                    required
                  />
                </div>
              ) : (
                <div className="flex items-start gap-2 rounded-md border border-dashed p-3 text-xs text-muted-foreground">
                  <CalendarCheck className="mt-0.5 size-4 shrink-0" />
                  No password needed — we&apos;ll email a one-time sign-in link.
                </div>
              )}

              {error ? (
                <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                  {error}
                </p>
              ) : null}
              {notice ? (
                <p className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-700 dark:text-emerald-400">
                  {notice}
                </p>
              ) : null}
            </CardContent>

            <CardFooter className="flex flex-col gap-3">
              <Button type="submit" className="w-full" disabled={submitting}>
                <LogIn className="size-4" />
                {submitting ? "Signing in…" : mode === "password" ? "Sign in" : "Send sign-in link"}
              </Button>
              <p className="text-xs text-muted-foreground">
                Need access? Ask a workspace owner for an invite.
              </p>
            </CardFooter>
          </form>
        )}
      </Card>
    </div>
  );
}
