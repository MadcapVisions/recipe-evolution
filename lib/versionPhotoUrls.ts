import type { SupabaseClient } from "@supabase/supabase-js";

export type VersionPhotoRow = {
  id: string;
  storage_path: string;
};

export type VersionPhotoWithUrl = {
  id: string;
  signedUrl: string;
  storagePath: string;
};

export const toVersionPhotoObjectPath = (storagePath: string) =>
  storagePath.startsWith("version-photos/") ? storagePath.replace(/^version-photos\//, "") : storagePath;

export async function signVersionPhotoUrls(
  supabase: SupabaseClient,
  photos: VersionPhotoRow[],
  expiresInSeconds = 60 * 60
): Promise<VersionPhotoWithUrl[]> {
  if (photos.length === 0) {
    return [];
  }

  const objectPaths = photos.map((photo) => toVersionPhotoObjectPath(photo.storage_path));
  type StorageBucket = ReturnType<typeof supabase.storage.from>;
  const storage = supabase.storage.from("version-photos") as StorageBucket & {
    createSignedUrls?: (paths: string[], expiresIn: number) => Promise<{
      data?: Array<{ path?: string; signedUrl?: string } | null>;
    }>;
  };

  if (typeof storage.createSignedUrls === "function") {
    const { data } = await storage.createSignedUrls(objectPaths, expiresInSeconds);
    const byPath = new Map<string, string>();

    for (const item of data ?? []) {
      if (item?.path && item.signedUrl) {
        byPath.set(item.path, item.signedUrl);
      }
    }

    return photos.flatMap((photo, index) => {
      const signedUrl = byPath.get(objectPaths[index]);
      if (!signedUrl) {
        return [];
      }

      return {
        id: photo.id,
        signedUrl,
        storagePath: photo.storage_path,
      };
    });
  }

  const signed = await Promise.all(
    photos.map(async (photo, index) => {
      const { data } = await supabase.storage.from("version-photos").createSignedUrl(objectPaths[index], expiresInSeconds);
      if (!data?.signedUrl) {
        return null;
      }

      return {
        id: photo.id,
        signedUrl: data.signedUrl,
        storagePath: photo.storage_path,
      };
    })
  );

  return signed.filter((photo): photo is VersionPhotoWithUrl => photo !== null);
}
