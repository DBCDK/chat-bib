import type { FileAttachment } from "../client/api";

// A summary of one uploaded file, shared in an assistant link (the `s` link
// param). Only the summary goes in the link, never the file itself.
export type FileSummary = { name: string; summary: string };

// Limits for summaries read from a link, which anyone can make.
const MAX_SUMMARIES = 10;
const MAX_SUMMARY_LENGTH = 2000;
// Stops a small link from unpacking into a huge amount of text.
const MAX_DECODED_BYTES = 100_000;

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = "";
  bytes.forEach((b) => (binary += String.fromCharCode(b)));
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

// No return type on purpose: newer TypeScript then keeps the bytes typed as
// backed by an ArrayBuffer, which `new Blob([...])` needs.
function base64UrlToBytes(encoded: string) {
  const binary = atob(encoded.replace(/-/g, "+").replace(/_/g, "/"));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function readAll(
  stream: ReadableStream<Uint8Array>,
  maxBytes: number,
): Promise<Uint8Array> {
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > maxBytes) {
      await reader.cancel();
      throw new Error("Too much data");
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  return bytes;
}

// Summaries go in the link as compressed JSON in base64url, so Danish text
// with spaces and æøå doesn't make the link (and its QR code) much longer.
// Like the `p` param, this only makes the link shorter; anyone with the link
// can read it.
export async function encodeFileSummaries(
  summaries: FileSummary[],
): Promise<string> {
  const json = new TextEncoder().encode(JSON.stringify(summaries));
  const stream = new Blob([json])
    .stream()
    .pipeThrough(new CompressionStream("deflate-raw"));
  return bytesToBase64Url(await readAll(stream, Infinity));
}

// Returns undefined when the param is broken (cut off, changed by hand) or
// holds no summaries.
export async function decodeFileSummaries(
  encoded: string,
): Promise<FileSummary[] | undefined> {
  try {
    const stream = new Blob([base64UrlToBytes(encoded)])
      .stream()
      .pipeThrough(new DecompressionStream("deflate-raw"));
    const bytes = await readAll(stream, MAX_DECODED_BYTES);
    const data = JSON.parse(
      new TextDecoder("utf-8", { fatal: true }).decode(bytes),
    );
    if (!Array.isArray(data)) return undefined;

    const summaries = data
      .filter(
        (s: any) =>
          s &&
          typeof s.name === "string" &&
          typeof s.summary === "string" &&
          s.summary.trim() !== "",
      )
      .slice(0, MAX_SUMMARIES)
      .map((s: any) => ({
        name: s.name.slice(0, 200),
        summary: s.summary.slice(0, MAX_SUMMARY_LENGTH),
      }));
    return summaries.length > 0 ? summaries : undefined;
  } catch {
    return undefined;
  }
}

const SUMMARY_PREFIX = "Resumé af ";

// A shared summary becomes a text file on the assistant (Mask.files), so it
// is sent with the system prompt like the files uploaded in the builder.
// "fotosyntese.pdf" becomes "Resumé af fotosyntese.pdf": only the summary is
// in the link, not the file. An assistant opened from a link can be shared
// again; its names already have the prefix.
export function summaryToFile(summary: FileSummary): FileAttachment {
  return {
    name: summary.name.startsWith(SUMMARY_PREFIX)
      ? summary.name
      : SUMMARY_PREFIX + summary.name,
    mime: "text/plain",
    text: summary.summary,
  };
}

// A summary from a shared link, not an uploaded file: uploaded files always
// have an id (the file is kept in IndexedDB), summaries don't.
export function isSummaryFile(file: FileAttachment): boolean {
  return !file.id && file.name.startsWith(SUMMARY_PREFIX);
}

export function isSameFiles(
  a: FileAttachment[] | undefined,
  b: FileAttachment[],
): boolean {
  return (
    a?.length === b.length &&
    a.every((file, i) => file.name === b[i].name && file.text === b[i].text)
  );
}
