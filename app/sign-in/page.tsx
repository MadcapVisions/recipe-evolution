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
        <h1 className="page-title">Return to your cookbook</h1>
        <p className="text-[16px] leading-7 text-[color:var(--muted)]">Access your dishes, saved versions, planning workflows, and taste preferences.</p>
      </div>
      <form onSubmit={handleSubmit} className="saas-card space-y-4 p-6">
        <div className="rounded-[24px] bg-[rgba(201,123,66,0.08)] p-4">
          <p className="app-kicker">What is waiting</p>
          <p className="mt-2 text-[15px] leading-7 text-[color:var(--muted)]">
            Pick up where you left off, revisit the latest version of a dish, or develop the next iteration with Chef.
          </p>
        </div>
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
        {error ? (
          <div className="rounded-[20px] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
        ) : null}
        <Button
          type="submit"
          disabled={loading}
          className="w-full"
        >
          {loading ? "Signing in..." : "Open My Cookbook"}
        </Button>
      </form>
      <p className="text-[15px] text-[color:var(--muted)]">
        Need an account?{" "}
        <Link href="/sign-up" className="text-[color:var(--primary)] hover:underline">
          Sign up
        </Link>
      </p>
    </div>
  );
}
