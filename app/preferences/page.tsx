export default async function PreferencesPage() {
  const { redirect } = await import("next/navigation");
  redirect("/settings");
}
