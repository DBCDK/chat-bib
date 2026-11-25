import heic2any from "heic2any";

export async function compressImage(
  file: File,
  maxSize: number,
): Promise<string> {
  const blob =
    file.type.includes("heic") || file.type.includes("heif")
      ? // Some files are labelled heic but are really a png or jpeg. The
        // converter then fails with an English error. Use the file as it is so
        // the normal path below handles it.
        await heic2any({ blob: file, toType: "image/jpeg" }).catch(() => file)
      : file;
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const image = new Image();
      image.onload = () => {
        const canvas = document.createElement("canvas");
        try {
          const ctx = canvas.getContext("2d");
          if (!ctx) throw new Error("Billedet kunne ikke behandles.");
          let width = image.width;
          let height = image.height;
          let quality = 0.9;
          let dataUrl;

          do {
            canvas.width = width;
            canvas.height = height;
            // JPEG has no transparency. Paint white so it does not turn black.
            ctx.fillStyle = "#ffffff";
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(image, 0, 0, width, height);
            dataUrl = canvas.toDataURL("image/jpeg", quality);

            if (dataUrl.length < maxSize) break;

            if (quality > 0.5) {
              quality -= 0.1;
            } else {
              width *= 0.9;
              height *= 0.9;
            }
          } while (dataUrl.length > maxSize);

          // A picture too big for the browser gives "data:,".
          if (!dataUrl.startsWith("data:image/"))
            throw new Error("Billedet er for stort.");
          resolve(dataUrl);
        } catch (error) {
          reject(error);
        } finally {
          canvas.width = 0;
        }
      };
      image.onerror = reject;
      image.src = reader.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(Array.isArray(blob) ? blob[0] : blob);
  });
}
