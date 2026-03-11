export async function trackServerEvent(
  supabase: { from: (table: string) => { insert: (values: Record<string, unknown>) => PromiseLike<{ error: { message?: string } | null }> | { error?: { message?: string } | null } } },
  ownerId: string,
  eventName: string,
  metadata?: Record<string, unknown>
) {
  const { error } = await supabase.from("product_events").insert({
    owner_id: ownerId,
    event_name: eventName,
    metadata_json: metadata ?? null,
  });

  if (error) {
    console.error("Failed to track server product event", error.message);
  }
}
