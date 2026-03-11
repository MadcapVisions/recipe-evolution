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
      className="w-full justify-start"
    >
      Sign Out
    </Button>
  );
}
