// What a picture costs in Gemma 4 with the default vLLM setup. 16 px patches
// are pooled 3 by 3 into at most 280 tokens. Two more mark its start and end.
export function gemmaImageTokens(width: number, height: number): number {
  const scale = Math.sqrt((280 * 9) / ((height / 16) * (width / 16)));
  const h = Math.max(48, Math.floor((height * scale) / 48) * 48);
  const w = Math.max(48, Math.floor((width * scale) / 48) * 48);
  return Math.min(((h / 16) * (w / 16)) / 9, 280) + 2;
}

// Uploads are saved as JPEG. The size is read from the start of the file so
// the picture is not drawn again. Other old pictures are counted as 300.
export function imageTokensFromUrl(url: string): number {
  try {
    if (!url.startsWith("data:image/jpeg;base64,")) return 300;
    // The size is stored near the start so the first part is enough.
    const start = url.indexOf(",") + 1;
    const data = atob(url.slice(start, start + 4096));
    const byte = (at: number) => data.charCodeAt(at);
    const word = (at: number) => byte(at) * 256 + byte(at + 1);
    if (word(0) !== 0xffd8) return 300;
    let offset = 2;
    while (offset + 3 < data.length) {
      if (byte(offset) !== 0xff) break;
      while (byte(offset) === 0xff) offset += 1;
      const marker = byte(offset++);
      if (marker === 0xda || marker === 0xd9) break;
      const length = word(offset);
      if (length < 2 || offset + length > data.length) break;
      if (
        marker >= 0xc0 &&
        marker <= 0xcf &&
        ![0xc4, 0xc8, 0xcc].includes(marker) &&
        length >= 8
      ) {
        const height = word(offset + 3);
        const width = word(offset + 5);
        if (width > 0 && height > 0) return gemmaImageTokens(width, height);
        break;
      }
      offset += length;
    }
  } catch {
    // Old chats may contain URLs or images that cannot be read here.
  }
  return 300;
}
