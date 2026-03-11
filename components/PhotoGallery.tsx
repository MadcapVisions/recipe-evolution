"use client";

import Image from "next/image";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { Button } from "@/components/Button";

type PhotoItem = {
  id: string;
  signedUrl: string;
  storagePath: string;
};

type PhotoGalleryProps = {
  photos: PhotoItem[];
};

const toObjectPath = (storagePath: string) =>
  storagePath.startsWith("version-photos/")
    ? storagePath.replace(/^version-photos\//, "")
    : storagePath;

export function PhotoGallery({ photos }: PhotoGalleryProps) {
  const router = useRouter();
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleDelete = async (photo: PhotoItem) => {
    setDeletingId(photo.id);
    setError(null);

    const objectPath = toObjectPath(photo.storagePath);

    const { error: storageError } = await supabase.storage
      .from("version-photos")
      .remove([objectPath]);

    if (storageError) {
      setError("Delete failed. Try again.");
      setDeletingId(null);
      return;
    }

    const { error: dbError } = await supabase
      .from("version_photos")
      .delete()
      .eq("id", photo.id);

    if (dbError) {
      setError("Delete failed. Try again.");
      setDeletingId(null);
      return;
    }

    setDeletingId(null);
    router.refresh();
  };

  if (photos.length === 0) {
    return <p className="text-sm text-slate-600">No photos yet.</p>;
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-4">
        {photos.map((photo) => (
          <div key={photo.id} className="space-y-2 rounded-xl border border-gray-200 bg-white p-2 shadow-sm transition hover:shadow-md">
            <Image
              src={photo.signedUrl}
              alt="Recipe version photo"
              width={320}
              height={160}
              className="h-40 w-full rounded-lg object-cover"
              sizes="(max-width: 768px) 100vw, 33vw"
            />
            <Button
              onClick={() => handleDelete(photo)}
              disabled={deletingId === photo.id}
              variant="secondary"
              className="min-h-10 w-full text-xs"
            >
              {deletingId === photo.id ? "Deleting..." : "Delete"}
            </Button>
          </div>
        ))}
      </div>
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
    </div>
  );
}
