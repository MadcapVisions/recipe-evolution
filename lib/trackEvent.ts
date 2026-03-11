import { supabase } from "@/lib/supabaseClient";

export async function trackEvent(eventName: string, metadata?: Record<string, unknown>) {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const ownerId = session?.user.id;

  if (!ownerId) {
    return;
  }

  const { error } = await supabase.from("product_events").insert({
    owner_id: ownerId,
    event_name: eventName,
    metadata_json: metadata ?? null,
  });

  if (error) {
    console.error("Failed to track product event", error.message);
  }
}
