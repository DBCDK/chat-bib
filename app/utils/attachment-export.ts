import type { RequestMessage } from "../client/api";
import { loadFileImages } from "./file-store";

// Puts the file pictures on the messages of an export. Only call it with a
// copy. The messages in the store must stay without pictures.
export async function addFilePicturesToExport(
  messages: RequestMessage[],
): Promise<void> {
  const hasAllPictures = (value: unknown, count: number): value is string[] =>
    Array.isArray(value) &&
    value.length >= count &&
    value.every((image) => typeof image === "string" && image.length > 0);
  const loaded = new Map<string, string[]>();
  for (const message of messages) {
    const parts = Array.isArray(message?.content) ? message.content : [];
    for (const part of parts) {
      const file = part?.type === "file" ? part.file : undefined;
      if (
        !file?.id ||
        !file.imageCount ||
        hasAllPictures(file.images, file.imageCount)
      )
        continue;
      let images = loaded.get(file.id);
      if (!images) {
        let timeout: ReturnType<typeof setTimeout> | undefined;
        try {
          images = await Promise.race([
            loadFileImages(file.id).then((value) => value ?? undefined),
            new Promise<undefined>((resolve) => {
              timeout = setTimeout(() => resolve(undefined), 5000);
            }),
          ]);
        } finally {
          clearTimeout(timeout);
        }
      }
      if (!hasAllPictures(images, file.imageCount)) {
        throw new Error("Billederne i sikkerhedskopien kunne ikke indlæses.");
      }
      loaded.set(file.id, images);
      file.images = images;
    }
  }
}
