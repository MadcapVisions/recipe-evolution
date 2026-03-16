"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { Button } from "@/components/Button";

export default function SignUpPage() {
  const router = useRouter();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    const safeFirstName = firstName.trim();
    const safeLastName = lastName.trim();
    const fullName = [safeFirstName, safeLastName].filter(Boolean).join(" ");

    const { error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          first_name: safeFirstName,
          last_name: safeLastName,
          display_name: fullName || null,
          full_name: fullName || null,
        },
      },
    });

    if (signUpError) {
      setError(signUpError.message);
      setLoading(false);
      return;
    }

    setMessage("Sign-up successful. Check your email to confirm your account.");
    setLoading(false);
    router.refresh();
  };

  return (
    <div className="mx-auto max-w-xl page-shell">
      <div className="space-y-3">
        <p className="app-kicker">Account</p>
        <h1 className="page-title">Build your personal cookbook</h1>
        <p className="text-[16px] leading-7 text-[color:var(--muted)]">Claim the free Starter Shelf, save your first strong version, and keep your kitchen system in one place.</p>
      </div>
      <form onSubmit={handleSubmit} className="saas-card space-y-4 p-6">
        <div className="rounded-[24px] bg-[rgba(79,125,115,0.08)] p-4">
          <p className="app-kicker">Free starter offer</p>
          <p className="mt-2 text-[15px] leading-7 text-[color:var(--muted)]">
            Your account gives you a place to import a recipe or start from a rough idea, refine it with Chef, and save the version you actually want to keep. No card required.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block space-y-1">
            <span className="text-[15px] font-medium text-[color:var(--text)]">First name</span>
            <input
              type="text"
              className="w-full"
              value={firstName}
              onChange={(event) => setFirstName(event.target.value)}
              required
            />
          </label>
          <label className="block space-y-1">
            <span className="text-[15px] font-medium text-[color:var(--text)]">Last name</span>
            <input
              type="text"
              className="w-full"
              value={lastName}
              onChange={(event) => setLastName(event.target.value)}
              required
            />
          </label>
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
        <Button
          type="submit"
          disabled={loading}
          className="w-full"
        >
          {loading ? "Creating account..." : "Claim My Free Starter Shelf"}
        </Button>
      </form>
      {message ? <p className="text-green-700">{message}</p> : null}
      {error ? <p className="text-red-700">{error}</p> : null}
      <p className="text-[15px] text-[color:var(--muted)]">
        Already have an account?{" "}
        <Link href="/sign-in" className="text-[color:var(--primary)] hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}
