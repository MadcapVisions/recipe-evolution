"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { Button } from "@/components/Button";

export default function SignInPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError(null);

    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });

    if (signInError) {
      setError(signInError.message);
      setLoading(false);
      return;
    }

    router.push("/dashboard");
    router.refresh();
    setLoading(false);
  };

  return (
    <div className="mx-auto max-w-xl page-shell">
      <div className="space-y-3">
        <p className="app-kicker">Account</p>
        <h1 className="page-title">Sign in</h1>
        <p className="text-[16px] leading-7 text-[color:var(--muted)]">Access your recipes, saved versions, and kitchen preferences.</p>
      </div>
      <form onSubmit={handleSubmit} className="saas-card space-y-4 p-6">
        <label className="block space-y-1">
          <span className="text-[15px] font-medium text-[color:var(--text)]">Email</span>
          <input
            type="email"
            className="w-full"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
        </label>
        <label className="block space-y-1">
          <span className="text-[15px] font-medium text-[color:var(--text)]">Password</span>
          <input
            type="password"
            className="w-full"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
        </label>
        <Button
          type="submit"
          disabled={loading}
          className="w-full"
        >
          {loading ? "Signing in..." : "Sign in"}
        </Button>
      </form>
      {error ? <p className="text-red-700">{error}</p> : null}
      <p className="text-[15px] text-[color:var(--muted)]">
        Need an account?{" "}
        <Link href="/sign-up" className="text-[color:var(--primary)] hover:underline">
          Sign up
        </Link>
      </p>
    </div>
  );
}
