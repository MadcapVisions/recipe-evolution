import { redirect } from "next/navigation";

type NewVersionPageProps = {
  params: Promise<{ id: string }>;
};

export default async function NewVersionPage({ params }: NewVersionPageProps) {
  const { id } = await params;
  redirect(`/recipes/${id}/versions/new`);
}
