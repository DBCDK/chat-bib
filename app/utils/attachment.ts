import { FileAttachment } from "../client/api";
import { nanoid } from "nanoid";
import { saveFileBlob } from "./file-store";

// Reads the text out of pdf/text files so the model can use it. Images don't go
// through here; they still use the old image path.

const MAX_PDF_PAGES = 80;
const MAX_TEXT_LENGTH = 80000;
// The file itself is kept in IndexedDB, not localStorage, so big files still
// work after a reload without filling up the small chat history.
const MAX_FILE_SIZE = 150 * 1024 * 1024;
// how wide (in px) the first-page preview picture is
const PREVIEW_WIDTH = 200;

const TEXT_EXTENSIONS = [
  "txt",
  "text",
  "md",
  "markdown",
  "csv",
  "tsv",
  "json",
  "xml",
  "html",
  "htm",
  "log",
];

// The file types the attach button allows, on top of images.
export const FILE_ACCEPT =
  "application/pdf,.pdf,.txt,.text,.md,.markdown,.csv,.tsv,.json,.xml,.html,.htm,.log";

export function isImageFile(file: File): boolean {
  return file.type.startsWith("image/");
}

// Draws a pdf page and returns it as a small jpeg picture, used for the preview.
async function renderPdfPage(page: any): Promise<string> {
  const scale = PREVIEW_WIDTH / page.getViewport({ scale: 1 }).width;
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement("canvas");
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  const context = canvas.getContext("2d");
  if (!context) return "";
  await page.render({ canvasContext: context, viewport }).promise;
  return canvas.toDataURL("image/jpeg", 0.7);
}

async function extractPdf(
  file: File,
): Promise<{ text: string; preview: string }> {
  const pdfjs = await import("pdfjs-dist");
  // pdf.js needs a helper file. We load it from /public as-is, because letting
  // the build tool bundle it breaks the build.
  pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

  const data = await file.arrayBuffer();
  const pdf = await pdfjs.getDocument({ data }).promise;
  const pageCount = Math.min(pdf.numPages, MAX_PDF_PAGES);
  const parts: string[] = [];
  let preview = "";
  let textLength = 0;
  for (let page = 1; page <= pageCount; page += 1) {
    const pdfPage = await pdf.getPage(page);
    // use the first page as the preview picture
    if (page === 1) preview = await renderPdfPage(pdfPage);
    const content = await pdfPage.getTextContent();
    const text = content.items
      .map((item: any) => ("str" in item ? item.str : ""))
      .join(" ");
    const part = `Side ${page}: ${text}`;
    parts.push(part);
    // stop once we have enough text; count as we go instead of re-joining
    textLength += part.length + 2;
    if (textLength > MAX_TEXT_LENGTH) break;
  }
  return { text: parts.join("\n\n").slice(0, MAX_TEXT_LENGTH), preview };
}

// Makes an attachment from a non-image file: the file is saved in IndexedDB
// under an id (so the viewer can open it later), plus the text we send to the
// model and a small preview picture.
export async function fileToAttachment(file: File): Promise<FileAttachment> {
  if (file.size > MAX_FILE_SIZE) {
    throw new Error("Filen er for stor (maks 150 MB).");
  }
  const mime = file.type || "application/octet-stream";
  const ext = (file.name.split(".").pop() || "").toLowerCase();
  const isPdf = ext === "pdf" || mime === "application/pdf";
  const isText = TEXT_EXTENSIONS.includes(ext) || mime.startsWith("text/");
  if (!isPdf && !isText) {
    throw new Error("Filtypen understøttes ikke.");
  }

  // Save the file in IndexedDB and keep only this id in the chat history.
  const id = nanoid();
  await saveFileBlob(id, file);

  if (isPdf) {
    // If reading the pdf fails we still attach it (you can still open it); the
    // model just won't get the text and there won't be a preview picture.
    let text = "";
    let preview = "";
    try {
      ({ text, preview } = await extractPdf(file));
    } catch {
      text = "";
    }
    return { name: file.name, mime: "application/pdf", id, text, preview };
  }

  const text = (await file.text()).slice(0, MAX_TEXT_LENGTH);
  return { name: file.name, mime: mime || "text/plain", id, text };
}
