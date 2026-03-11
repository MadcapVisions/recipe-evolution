import { redirect } from "next/navigation";

type RecipeAliasPageProps = {
  params: Promise<{ id: string }>;
};

export default async function RecipeAliasPage({ params }: RecipeAliasPageProps) {
  const { id } = await params;
  redirect(`/recipes/${id}`);
}

