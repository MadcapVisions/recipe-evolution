export function downloadTextFile(filename: string, text: string) {
  if (typeof window === "undefined") {
    return;
  }

  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export async function shareOrFallback(title: string, text: string, onFallback: () => void) {
  if (typeof navigator !== "undefined" && navigator.share) {
    try {
      await navigator.share({ title, text });
      return;
    } catch {
      // ignore cancellations
    }
  }

  onFallback();
}
