import { redirect } from "next/navigation";

export default function ImportPage() {
  redirect("/recipes/new/from-text");
}
