"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Button } from "@/components/Button";

type AccountSettingsFormProps = {
  initialEmail: string;
  initialDisplayName: string;
};

export function AccountSettingsForm({
  initialEmail,
  initialDisplayName,
}: AccountSettingsFormProps) {
  const [displayName, setDisplayName] = useState(initialDisplayName);
  const [newEmail, setNewEmail] = useState(initialEmail);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingEmail, setSavingEmail] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const clearFeedback = () => {
    setMessage(null);
    setError(null);
  };

  const handleSaveProfile = async () => {
    clearFeedback();
    setSavingProfile(true);

    const { error: updateError } = await supabase.auth.updateUser({
      data: {
        display_name: displayName.trim() || null,
      },
    });

    if (updateError) {
      setError(updateError.message);
      setSavingProfile(false);
      return;
    }

    setMessage("Account details updated.");
    setSavingProfile(false);
  };

  const handleSaveEmail = async () => {
    clearFeedback();
    setSavingEmail(true);

    const nextEmail = newEmail.trim();
    if (!nextEmail) {
      setError("Email is required.");
      setSavingEmail(false);
      return;
    }

    const { error: updateError } = await supabase.auth.updateUser({
      email: nextEmail,
    });

    if (updateError) {
      setError(updateError.message);
      setSavingEmail(false);
      return;
    }

    setMessage("Email update requested. Check your inbox to confirm the change.");
    setSavingEmail(false);
  };

  const handleSavePassword = async () => {
    clearFeedback();
    setSavingPassword(true);

    if (newPassword.length < 8) {
      setError("Password must be at least 8 characters.");
      setSavingPassword(false);
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      setSavingPassword(false);
      return;
    }

    const { error: updateError } = await supabase.auth.updateUser({
      password: newPassword,
    });

    if (updateError) {
      setError(updateError.message);
      setSavingPassword(false);
      return;
    }

    setNewPassword("");
    setConfirmPassword("");
    setMessage("Password updated.");
    setSavingPassword(false);
  };

  return (
    <section className="saas-card space-y-6 p-5">
      <div className="settings-highlight p-4">
        <p className="text-[14px] font-semibold uppercase tracking-[0.18em] text-[color:var(--muted)]">Account summary</p>
        <p className="mt-2 text-[18px] font-semibold text-[color:var(--text)]">{initialDisplayName || "Set your display name"}</p>
        <p className="mt-1 text-[15px] leading-6 text-[color:var(--muted)]">
          Manage the name attached to your cookbook, the email you sign in with, and your password.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-1">
          <label htmlFor="displayName" className="text-[15px] font-medium text-[color:var(--text)]">
            Display Name
          </label>
          <input
            id="displayName"
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
            className="settings-field min-h-12 w-full"
            placeholder="How you want to be addressed"
          />
        </div>
        <div className="space-y-1">
          <label htmlFor="currentEmail" className="text-[15px] font-medium text-[color:var(--text)]">
            Current Email
          </label>
          <input id="currentEmail" value={initialEmail} readOnly className="settings-field min-h-12 w-full opacity-80" />
        </div>
      </div>

      <Button onClick={handleSaveProfile} disabled={savingProfile} className="min-h-12 w-full sm:w-auto">
        {savingProfile ? "Saving..." : "Save Identity Details"}
      </Button>

      <div className="settings-section p-4">
        <p className="text-[14px] font-semibold uppercase tracking-[0.18em] text-[color:var(--muted)]">Email</p>
        <p className="mt-2 text-[15px] leading-6 text-[color:var(--muted)]">
          Change the email tied to your cookbook account. Supabase will ask you to confirm the update in your inbox.
        </p>
        <div className="mt-3 grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto]">
          <div className="space-y-1">
            <label htmlFor="newEmail" className="text-[15px] font-medium text-[color:var(--text)]">
              New Email Address
            </label>
            <input
              id="newEmail"
              type="email"
              value={newEmail}
              onChange={(event) => setNewEmail(event.target.value)}
              className="settings-field min-h-12 w-full"
            />
          </div>
          <div className="flex items-end">
            <Button onClick={handleSaveEmail} disabled={savingEmail} className="min-h-12 w-full sm:w-auto">
              {savingEmail ? "Updating..." : "Update Email"}
            </Button>
          </div>
        </div>
      </div>

      <div className="settings-section p-4">
        <p className="text-[14px] font-semibold uppercase tracking-[0.18em] text-[color:var(--muted)]">Password</p>
        <p className="mt-2 text-[15px] leading-6 text-[color:var(--muted)]">
          Use a strong password so access to your dishes, versions, and preferences stays protected.
        </p>
        <div className="mt-3 grid gap-4 lg:grid-cols-2">
          <div className="space-y-1">
            <label htmlFor="newPassword" className="text-[15px] font-medium text-[color:var(--text)]">
              New Password
            </label>
            <input
              id="newPassword"
              type="password"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              className="settings-field min-h-12 w-full"
              placeholder="At least 8 characters"
            />
          </div>
          <div className="space-y-1">
            <label htmlFor="confirmPassword" className="text-[15px] font-medium text-[color:var(--text)]">
              Confirm Password
            </label>
            <input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              className="settings-field min-h-12 w-full"
            />
          </div>
        </div>
        <Button onClick={handleSavePassword} disabled={savingPassword} className="mt-4 min-h-12 w-full sm:w-auto">
          {savingPassword ? "Updating..." : "Update Password"}
        </Button>
      </div>

      {message ? <p className="text-sm text-green-700">{message}</p> : null}
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
    </section>
  );
}
