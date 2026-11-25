import { FileAttachment } from "../client/api";
import { nanoid } from "nanoid";
import { saveFileBlob, saveFileImages, deleteFileBlob } from "./file-store";
import { compressImage } from "./chat";
import { imageTokensFromUrl } from "./gemma-image-tokens";
import { MATERIAL_TOKEN_BUDGET } from "./message-content";

// A PDF is sent as one picture per page. Word and text files are sent as text
// plus their pictures. Single pictures go through processFiles in chat.tsx.

const MAX_PDF_PAGES = 80;
const MAX_TEXT_LENGTH = 80000;
// The file itself is kept in IndexedDB, not localStorage, so big files still
// work after a reload without filling up the small chat history.
const MAX_FILE_SIZE = 150 * 1024 * 1024;
// how wide (in px) the first-page preview picture is
const PREVIEW_WIDTH = 200;

// How wide a page is drawn when the picture goes to the model. This is set by
// what it takes to read small print and a table.
const PDF_PAGE_IMAGE_WIDTH = 1000;

// How big one picture from a file may be. That is a picture inside a Word file
// or a PDF page drawn as a picture. It is the same limit as for a picture the
// pupil attaches so a scanned worksheet stays readable. Pictures are sent
// again with later messages and this keeps each request small.
const MAX_FILE_IMAGE_SIZE = 256 * 1024;

type ExtractedDocument = {
  text: string;
  images: string[];
  preview: string;
  warning?: string;
  pdfPageCount?: number;
};

// The MIME type of a .docx file. Word and Google Docs both make this kind of
// file.
export const DOCX_MIME =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

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
  "application/pdf,.pdf,.docx," +
  DOCX_MIME +
  ",.txt,.text,.md,.markdown,.csv,.tsv,.json,.xml,.html,.htm,.log";

export function isImageFile(file: File): boolean {
  return file.type.startsWith("image/");
}

// Cuts a long text and tells the model on a first line that the rest is gone.
function limitFileText(text: string): string {
  if (text.length <= MAX_TEXT_LENGTH) return text;
  let end = MAX_TEXT_LENGTH;
  // Do not cut between the two halves of a character like an emoji.
  const last = text.charCodeAt(end - 1);
  const next = text.charCodeAt(end);
  if (last >= 0xd800 && last <= 0xdbff && next >= 0xdc00 && next <= 0xdfff)
    end -= 1;
  return (
    "Kun begyndelsen af filen blev læst. Resten er ikke med.\n\n" +
    text.slice(0, end)
  );
}

// Draws a pdf page and returns it as a jpeg picture. The small default size is
// for the preview. A bigger one is asked for when the page goes to the model.
async function renderPdfPage(
  page: any,
  width = PREVIEW_WIDTH,
): Promise<string> {
  const scale = width / page.getViewport({ scale: 1 }).width;
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement("canvas");
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  try {
    const context = canvas.getContext("2d");
    if (!context) return "";
    await page.render({ canvasContext: context, viewport }).promise;
    // A scanned page is a photo and makes a big picture. Lower the quality
    // until it is small enough. The token cost is the same at any quality. A
    // page with a lot of detail can still be over the limit at 0.3.
    let image = "";
    for (const quality of [0.7, 0.6, 0.5, 0.4, 0.3]) {
      image = canvas.toDataURL("image/jpeg", quality);
      if (image.length <= MAX_FILE_IMAGE_SIZE) break;
    }
    // The browser returns "data:," for a page that is too big to draw.
    return image.startsWith("data:image/") ? image : "";
  } finally {
    // Free the canvas memory also when drawing fails. iPads run out fast.
    canvas.width = 0;
  }
}

async function extractPdf(file: File): Promise<ExtractedDocument> {
  // This is the legacy build of pdf.js. The normal build needs Safari 26.2 or
  // newer and many school iPads cannot get that. The legacy build brings the
  // newer JavaScript it needs along.
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  // pdf.js needs a worker file. It is loaded from /public unchanged because
  // bundling it breaks the build. It is a copy of
  // node_modules/pdfjs-dist/legacy/build/pdf.worker.min.mjs.
  pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

  const data = await file.arrayBuffer();
  const images: string[] = [];
  let preview = "";
  let totalPages = 0;
  // Each PDF gets its own pdf.js worker that holds the whole file. The worker
  // only stops when the loading task is destroyed. So that is done no matter
  // how the reading ends.
  const loading = pdfjs.getDocument({
    data,
    // pdf.js needs these helper files to read black and white scans (CCITT
    // and JBIG2 pictures) and JPEG 2000 pictures. Without them such a page is
    // drawn as a blank white page. They are copied as they are from
    // node_modules/pdfjs-dist/wasm and must be the same version as
    // pdf.worker.min.mjs.
    wasmUrl: "/pdfjs-wasm/",
    // Some fonts need these character maps to draw their text. Chinese and
    // Japanese and Korean ones often do. Without them the text is missing from
    // the page picture. They are copied from node_modules/pdfjs-dist/cmaps and
    // must be the same version as pdf.worker.min.mjs.
    cMapUrl: "/pdfjs-cmaps/",
    cMapPacked: true,
  });
  try {
    const pdf = await loading.promise;
    totalPages = pdf.numPages;
    const pageCount = Math.min(totalPages, MAX_PDF_PAGES);
    for (let page = 1; page <= pageCount; page += 1) {
      let pdfPage;
      try {
        pdfPage = await pdf.getPage(page);
        const image = await renderPdfPage(pdfPage, PDF_PAGE_IMAGE_WIDTH);
        // Stop at the first unreadable page so no page is skipped in between.
        if (!image) break;
        images.push(image);
        if (page === 1) {
          try {
            preview = await renderPdfPage(pdfPage);
          } catch {
            // The file can still be read without a preview picture.
          }
        }
      } catch {
        break;
      } finally {
        pdfPage?.cleanup();
      }
    }
  } finally {
    await loading.destroy();
  }
  return {
    text: images.length
      ? "PDF'en er vedhæftet som sidebilleder. Kun sider med et vedhæftet billede kan læses.\n\n" +
        (images.length < totalPages
          ? `Kun de første ${images.length} af ${totalPages} sider blev læst ind. Resten er ikke med.\n\n`
          : "") +
        images.map((_, i) => `Side ${i + 1} [Billede ${i + 1}]`).join("\n\n")
      : "",
    images,
    preview,
    pdfPageCount: totalPages,
  };
}

// Turns one html element into markdown. Markdown is used because the model
// reads it well and because plain text would throw away the shape of the
// document. A table would become a list of loose words and a heading would
// look like any other line.
function nodeToMarkdown(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) {
    return (node.textContent ?? "").replace(/\s+/g, " ");
  }
  if (node.nodeType !== Node.ELEMENT_NODE) return "";

  const element = node as Element;
  const tag = element.tagName.toLowerCase();
  const inner = () =>
    Array.from(element.childNodes).map(nodeToMarkdown).join("");

  if (tag === "br") return "\n";
  if (tag === "strong" || tag === "b") return "**" + inner().trim() + "**";
  if (tag === "em" || tag === "i") return "*" + inner().trim() + "*";
  if (tag === "sup" || tag === "sub") return `<${tag}>${inner()}</${tag}>`;
  if (tag === "a") {
    const text = inner();
    const href = element.getAttribute("href");
    return href && text.trim() !== href ? `${text} (${href})` : text;
  }

  // The picture itself is sent to the model separately. Here it only leaves a
  // mark that shows where in the text it belongs. extractDocx puts the
  // picture's number in src. An empty src means the picture was left out.
  if (tag === "img") {
    const number = element.getAttribute("src");
    return number
      ? "[Billede " + number + "]"
      : "[Billede som ikke blev sendt med]";
  }

  const heading = /^h([1-6])$/.exec(tag);
  if (heading) {
    return "\n" + "#".repeat(Number(heading[1])) + " " + inner().trim() + "\n";
  }

  if (tag === "ol" || tag === "ul") {
    const start = Number.parseInt(element.getAttribute("start") ?? "1", 10);
    const items = Array.from(element.children).filter(
      (child) => child.tagName.toLowerCase() === "li",
    );
    return (
      "\n" +
      items
        .map((item, index) => {
          const prefix =
            tag === "ol"
              ? `${(Number.isFinite(start) ? start : 1) + index}.`
              : "-";
          const text = nodeToMarkdown(item)
            .trim()
            .replace(/\n/g, "\n" + " ".repeat(prefix.length + 1));
          return prefix + " " + text + "\n";
        })
        .join("")
    );
  }
  if (tag === "p") return "\n" + inner().trim() + "\n";

  if (tag === "table") {
    // Take only the rows of this table. A table inside a cell is written as
    // part of that cell. Otherwise its text and pictures would appear twice.
    const rows = Array.from(element.querySelectorAll("tr")).filter(
      (row) => row.closest("table") === element,
    );
    if (rows.length === 0) return "";
    const cellsOf = (row: Element) =>
      Array.from(row.children)
        .filter((cell) => /^t[dh]$/i.test(cell.tagName))
        .map((cell) =>
          // a line break inside a cell would break the table so flatten it
          nodeToMarkdown(cell)
            .replace(/\s+/g, " ")
            .trim()
            .replace(/\\/g, "\\\\")
            .replace(/\|/g, "\\|"),
        );
    const head = cellsOf(rows[0]);
    const lines = ["| " + head.join(" | ") + " |"];
    lines.push("| " + head.map(() => "---").join(" | ") + " |");
    for (const row of rows.slice(1)) {
      lines.push("| " + cellsOf(row).join(" | ") + " |");
    }
    return "\n" + lines.join("\n") + "\n";
  }

  return inner();
}

// Reads a Word document. mammoth turns the .docx into HTML and nodeToMarkdown
// turns that into markdown so tables and headings reach the model. Each
// picture becomes a mark like [Billede 2] in the text. The picture itself goes
// in "images" because the model can only take a picture as its own part. The
// mark shows where in the text it belongs.
async function extractDocx(file: File): Promise<ExtractedDocument> {
  const mammoth = await import("mammoth");

  const images: string[] = [];
  let imageTokens = 0;
  let imageConversionFailed = false;
  const result = await mammoth.convertToHtml(
    { arrayBuffer: await file.arrayBuffer() },
    {
      convertImage: mammoth.images.imgElement(async (image) => {
        // Pictures are sent in order from the first one. When they alone fill
        // the budget no later picture can be sent. So stop reading them.
        if (imageTokens < MATERIAL_TOKEN_BUDGET) {
          try {
            const buffer = await image.readAsArrayBuffer();
            const asFile = new File([buffer], "billede", {
              type: image.contentType,
            });
            const small = await compressImage(asFile, MAX_FILE_IMAGE_SIZE);
            images.push(small);
            imageTokens += imageTokensFromUrl(small);
            // the picture's number that nodeToMarkdown puts in the mark
            return { src: String(images.length) };
          } catch {
            // The text is still useful. The pupil is told a picture is gone.
            imageConversionFailed = true;
          }
        }
        // no number so nodeToMarkdown marks it as left out
        return { src: "" };
      }),
    },
  );

  const root = new DOMParser().parseFromString(result.value, "text/html").body;
  // Empty tables and marks for lost pictures do not count as content. A file
  // with only pictures is still useful.
  const hasContent = images.length > 0 || !!root.textContent?.trim();
  const text = (hasContent ? nodeToMarkdown(root) : "")
    // two or more blank lines in a row read badly so cut them down to one
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  // Mammoth warns about harmless things too like a style it does not know.
  // Only tell the pupil when content was really lost.
  const conversionNote =
    imageConversionFailed ||
    result.messages.some(
      (message) =>
        message.type === "error" ||
        (message.type === "warning" &&
          /was ignored|Could not find image/.test(message.message)),
    )
      ? "Noget indhold eller formatering kan mangle. Vedhæft filen som PDF, hvis formler eller layout er vigtige."
      : "";
  const cutWarning =
    text.length > MAX_TEXT_LENGTH
      ? file.name + " er for lang. Kun begyndelsen blev læst."
      : undefined;
  const warning =
    [conversionNote && `${file.name}: ${conversionNote}`, cutWarning]
      .filter(Boolean)
      .join(" ") || undefined;
  // An empty file stays empty. The note alone is not content.
  return {
    text:
      text &&
      (conversionNote ? conversionNote + "\n\n" : "") + limitFileText(text),
    images,
    preview: "",
    warning,
  };
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
  const isWord = ext === "docx" || mime === DOCX_MIME;
  const isText = TEXT_EXTENSIONS.includes(ext) || mime.startsWith("text/");
  // A .doc file is the old Word format from before 2007 and a browser cannot
  // read it. Tell the pupil what to do and not just that it is not supported.
  if (ext === "doc") {
    throw new Error(
      "Gamle .doc filer kan ikke læses. Gem filen som .docx og prøv igen.",
    );
  }
  if (!isPdf && !isWord && !isText) {
    throw new Error("Filtypen understøttes ikke.");
  }

  // Save the file in IndexedDB and keep only this id in the chat history.
  const id = nanoid();
  try {
    await saveFileBlob(id, file);

    if (isPdf || isWord) {
      const result = await (isPdf ? extractPdf(file) : extractDocx(file)).catch(
        () => null,
      );
      // A file that could not be read gives the model nothing. So it is not
      // attached. A PDF that could be read always has its page marks as text.
      if (!result?.text) {
        throw new Error(
          `${isPdf ? "Pdf" : "Word"}-filen kunne ikke læses. Er den beskyttet med en adgangskode?`,
        );
      }
      const { text, images, preview, warning, pdfPageCount } = result;
      // The pictures are kept next to the file instead of in the chat. See
      // withFilePictures in the chat store.
      if (images.length) await saveFileImages(id, images);
      return {
        name: file.name,
        mime: isPdf ? "application/pdf" : DOCX_MIME,
        id,
        text,
        preview,
        warning,
        imageCount: images.length,
        imageTokens: images.map(imageTokensFromUrl),
        pdfPageCount,
      };
    }

    // Only the start of a text file is used. So only read that much and not a
    // file that can be 150 MB. One character takes at most 4 bytes.
    const rawText = await file.slice(0, 4 * (MAX_TEXT_LENGTH + 1)).text();
    if (!rawText.trim())
      throw new Error("Filen indeholder ingen læsbar tekst.");
    const text = limitFileText(rawText);
    const warning =
      rawText.length > MAX_TEXT_LENGTH
        ? file.name + " er for lang. Kun begyndelsen blev læst."
        : undefined;
    return { name: file.name, mime, id, text, warning };
  } catch (error) {
    await deleteFileBlob(id);
    throw error;
  }
}
