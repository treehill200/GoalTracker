"use client";
import Link from "next/link";
import { Loader2, Mail } from "lucide-react";
import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { useFeatures } from "@/lib/features";
import { getBrowserSupabase } from "@/lib/supabase/client";
import { LogoMark } from "@/components/shell/logo";
import { CoachAvatar } from "@/components/coach/avatar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/input";

function LoginForm() {
  const f = useFeatures();
  const params = useSearchParams();
  const next = params.get("next") ?? "/";
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  if (!f.supabase || !f.supabaseUrl || !f.supabaseAnonKey) {
    return (
      <Card className="text-center">
        <p className="font-semibold">You&apos;re in demo mode</p>
        <p className="text-muted-foreground mt-1 text-sm">
          No account needed — data stays in this browser. Add Supabase keys to enable sign-in and
          sync.
        </p>
        <Button asChild className="mt-4">
          <Link href="/">Open the app</Link>
        </Button>
      </Card>
    );
  }
  const sb = getBrowserSupabase(f.supabaseUrl, f.supabaseAnonKey);
  const redirect = `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;

  return (
    <Card className="space-y-4">
      {sent ? (
        <div className="py-4 text-center" role="status">
          <Mail className="text-blue mx-auto size-8" aria-hidden />
          <p className="mt-2 font-semibold">Check your email</p>
          <p className="text-muted-foreground text-sm">We sent a sign-in link to {email}.</p>
        </div>
      ) : (
        <form
          className="space-y-3"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            const { error } = await sb.auth.signInWithOtp({
              email,
              options: { emailRedirectTo: redirect },
            });
            setBusy(false);
            if (error) toast.error(error.message);
            else setSent(true);
          }}
        >
          <Field label="Email" htmlFor="login-email">
            <Input
              id="login-email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
            />
          </Field>
          <Button type="submit" className="w-full" disabled={busy}>
            {busy ? <Loader2 className="animate-spin" /> : <Mail />} Email me a magic link
          </Button>
        </form>
      )}
      {f.googleAuth ? (
        <>
          <div className="text-muted-foreground flex items-center gap-3 text-xs">
            <span className="bg-border h-px flex-1" /> or <span className="bg-border h-px flex-1" />
          </div>
          <Button
            variant="secondary"
            className="w-full"
            onClick={async () => {
              const { error } = await sb.auth.signInWithOAuth({
                provider: "google",
                options: { redirectTo: redirect },
              });
              if (error) toast.error(error.message);
            }}
          >
            <svg viewBox="0 0 24 24" className="size-4" aria-hidden>
              <path
                fill="#4285F4"
                d="M22.6 12.2c0-.8-.1-1.5-.2-2.2H12v4.2h6a5.1 5.1 0 0 1-2.2 3.4v2.8h3.6c2.1-1.9 3.2-4.8 3.2-8.2Z"
              />
              <path
                fill="#34A853"
                d="M12 23c3 0 5.5-1 7.3-2.7l-3.6-2.8c-1 .7-2.2 1.1-3.7 1.1-2.9 0-5.3-1.9-6.2-4.5H2.1v2.9A11 11 0 0 0 12 23Z"
              />
              <path
                fill="#FBBC05"
                d="M5.8 14.1a6.6 6.6 0 0 1 0-4.2V7H2.1a11 11 0 0 0 0 10l3.7-2.9Z"
              />
              <path
                fill="#EA4335"
                d="M12 5.4c1.6 0 3.1.6 4.2 1.7l3.2-3.2A11 11 0 0 0 2.1 7l3.7 2.9C6.7 7.3 9.1 5.4 12 5.4Z"
              />
            </svg>
            Continue with Google
          </Button>
        </>
      ) : null}
    </Card>
  );
}

export default function LoginPage() {
  return (
    <div className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-6 px-4 py-10">
      <div className="flex flex-col items-center text-center">
        <CoachAvatar coach="blaze" mood="happy" size={96} />
        <h1 className="mt-3 flex items-center gap-2 text-2xl font-bold tracking-tight">
          <LogoMark /> Goal Tracker
        </h1>
        <p className="text-muted-foreground text-sm">
          Turn big goals into numbers — and finish them.
        </p>
      </div>
      <Suspense>
        <LoginForm />
      </Suspense>
    </div>
  );
}
