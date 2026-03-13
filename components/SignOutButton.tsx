"use client";

import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { Button } from "@/components/Button";

export function SignOutButton() {
  const router = useRouter();

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push("/sign-in");
    router.refresh();
  };

  return (
    <Button
      onClick={handleSignOut}
      variant="secondary"
      className="min-h-12 w-full justify-center sm:w-auto"
    >
      Sign Out
    </Button>
  );
}
