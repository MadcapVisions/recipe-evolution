"use client";

import { ChangeEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type PhotoUploadProps = {
  userId: string;
  versionId: string;
  compact?: boolean;
};

export function PhotoUpload({ userId, versionId, compact = false }: PhotoUploadProps) {
  const router = useRouter();
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const formatUploadError = (message: string) => {
    if (message.includes("Bucket not found")) {
      return "Upload failed. Storage bucket 'version-photos' is missing.";
    }
    if (message.includes("new row violates row-level security policy")) {
      return "Upload failed. Storage permissions are not configured for this user.";
    }
    if (message.includes("version_photos") && message.includes("does not exist")) {
      return "Upload failed. version_photos table is missing.";
    }
    return `Upload failed. Try again. (${message})`;
  };

  const handleUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    setUploading(true);
    setError(null);

    const ext = file.name.includes(".") ? file.name.split(".").pop() : "jpg";
    const filename = `${crypto.randomUUID()}.${ext}`;
    const objectPath = `${userId}/${versionId}/${filename}`;
    const storagePath = `version-photos/${objectPath}`;

    const { error: uploadError } = await supabase.storage
      .from("version-photos")
      .upload(objectPath, file, {
        contentType: file.type || "image/jpeg",
        upsert: false,
      });

    if (uploadError) {
      setError(formatUploadError(uploadError.message));
      setUploading(false);
      return;
    }

    const { error: insertError } = await supabase.from("version_photos").insert({
      version_id: versionId,
      storage_path: storagePath,
    });

    if (insertError) {
      setError(formatUploadError(insertError.message));
      setUploading(false);
      return;
    }

    event.target.value = "";
    setUploading(false);
    router.refresh();
  };

  return (
    <div className="space-y-2">
      <label
        className={
          compact
            ? "cursor-pointer rounded-lg border border-slate-300 bg-white px-3 py-1 text-sm font-medium text-slate-700 transition hover:border-indigo-400"
            : "cursor-pointer rounded-lg border-2 border-dashed border-slate-300 p-8 text-center text-sm font-medium text-gray-700 transition hover:border-indigo-400"
        }
      >
        {uploading ? "Uploading..." : compact ? "Upload" : "Upload Photo"}
        <input
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleUpload}
          disabled={uploading}
        />
      </label>
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
    </div>
  );
}
