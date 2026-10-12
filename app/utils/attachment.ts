import { FileAttachment } from "../client/api";
import { nanoid } from "nanoid";
import { saveFileBlob } from "./file-store";

// Reads the text out of pdf, Word and text files so the model can use it.
// Images don't go through here; they still use the old image path.

const MAX_PDF_PAGES = 80;
const MAX_TEXT_LENGTH = 80000;
// The file itself is kept in IndexedDB, not localStorage, so big files still
// work after a reload without filling up the small chat history.
const MAX_FILE_SIZE = 150 * 1024 * 1024;
// how wide (in px) the first-page preview picture is
const PREVIEW_WIDTH = 200;

// How wide a page is drawn when the picture goes to the model. A picture costs
// the model the same whatever size it is so this is set by what it takes to
// read small print and a table.
const PDF_PAGE_IMAGE_WIDTH = 1000;

// How many pages are sent as pictures. The text of the whole document still
// goes along so this only limits how much the model gets to look at.
const MAX_PDF_IMAGE_PAGES = 50;

// How much all the page pictures from one pdf may add up to, the same as for
// the pictures in a Word document. A scanned page is big, so this stops a long
// scanned file from making a request too big for the model.
const MAX_PDF_IMAGE_TEXT_LENGTH = 20 * 1024 * 1024;

// What a .docx says it is. Word and Google Docs both make this kind of file.
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
  const context = canvas.getContext("2d");
  if (!context) return "";
  await page.render({ canvasContext: context, viewport }).promise;
  const image = canvas.toDataURL("image/jpeg", 0.7);
  // Give the room back right away. Safari only lets a page use so much room
  // for drawing, and a long pdf draws a lot of pages in a row.
  canvas.width = 0;
  return image;
}

async function extractPdf(
  file: File,
): Promise<{ text: string; images: string[]; preview: string }> {
  const pdfjs = await import("pdfjs-dist");
  // pdf.js needs a helper file. We load it from /public as-is, because letting
  // the build tool bundle it breaks the build.
  pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

  const data = await file.arrayBuffer();
  const pdf = await pdfjs.getDocument({ data }).promise;
  const pageCount = Math.min(pdf.numPages, MAX_PDF_PAGES);
  const parts: string[] = [];
  const images: string[] = [];
  let usedImageTextLength = 0;
  let preview = "";
  let textLength = 0;
  for (let page = 1; page <= pageCount; page += 1) {
    const pdfPage = await pdf.getPage(page);
    // use the first page as the preview picture
    if (page === 1) preview = await renderPdfPage(pdfPage);
    // Send the page as a picture as well. Drawings and tables are not in the
    // text at all and a scanned page has no text to read.
    let mark = "";
    if (
      page <= MAX_PDF_IMAGE_PAGES &&
      usedImageTextLength < MAX_PDF_IMAGE_TEXT_LENGTH
    ) {
      try {
        const image = await renderPdfPage(pdfPage, PDF_PAGE_IMAGE_WIDTH);
        // renderPdfPage gives "" when the browser has no room to draw it
        if (image) {
          images.push(image);
          usedImageTextLength += image.length;
          // same [Billede N] mark as a picture in a Word document, and only
          // pages that were really sent get a number
          mark = " [Billede " + images.length + "]";
        }
      } catch {
        // a page we cannot draw is simply left out
      }
    }
    const content = await pdfPage.getTextContent();
    const text = content.items
      .map((item: any) => ("str" in item ? item.str : ""))
      .join(" ");
    const part = `Side ${page}${mark}: ${text}`;
    parts.push(part);
    // stop once we have enough text; count as we go instead of re-joining
    textLength += part.length + 2;
    if (textLength > MAX_TEXT_LENGTH) break;
  }
  return {
    text: parts.join("\n\n").slice(0, MAX_TEXT_LENGTH),
    images,
    preview,
  };
}

// How much all the pictures from one Word document may add up to, measured
// on the text form each picture is turned into. There is no limit on how many
// there can be because a worksheet often has a lot of figures and they should
// all reach the model. This is set high on purpose and is only here so one
// odd file with hundreds of pictures cannot make a request of many megabytes.
const MAX_DOCX_IMAGE_TEXT_LENGTH = 20 * 1024 * 1024;

// How big one picture from inside a document may be. The same limit as a
// picture the user picks, so a scanned worksheet still stays readable. These
// pictures are never saved in the chat, only sent once with the message they
// came from, but they still have to travel to the model in that one request,
// so keeping them small keeps that request a reasonable size.
const MAX_DOCX_IMAGE_SIZE = 256 * 1024;

// The whole document has to be drawn before the first page can be turned into
// a small picture. That takes a while for a very long file so the small
// picture is skipped above this size and the file gets a plain badge instead.
const MAX_DOCX_PREVIEW_SIZE = 5 * 1024 * 1024;

// Put on a picture's src when it was sent, so nodeToMarkdown can tell sent
// pictures apart from ones that were left out.
const SENT_IMAGE_SRC = "sent";

// Turns one html element into markdown. Markdown is used because the model
// reads it well and because plain text would throw away the shape of the
// document. A table would become a list of loose words and a heading would
// look like any other line.
function nodeToMarkdown(
  node: Node,
  imageCount: { sent: number },
): string {
  if (node.nodeType === Node.TEXT_NODE) {
    return (node.textContent ?? "").replace(/\s+/g, " ");
  }
  if (node.nodeType !== Node.ELEMENT_NODE) return "";

  const element = node as Element;
  const tag = element.tagName.toLowerCase();
  const inner = () =>
    Array.from(element.childNodes)
      .map((child) => nodeToMarkdown(child, imageCount))
      .join("");

  if (tag === "br") return "\n";
  if (tag === "strong" || tag === "b") return "**" + inner().trim() + "**";
  if (tag === "em" || tag === "i") return "*" + inner().trim() + "*";

  // The picture itself is sent to the model on its own. This only leaves a
  // mark so the model can tell where in the text the picture belongs.
  if (tag === "img") {
    // Only pictures that were really sent get a number, so the numbers still
    // match the pictures the model gets when one in the middle was left out.
    if (element.getAttribute("src") !== SENT_IMAGE_SRC) {
      return "[Billede som ikke blev sendt med]";
    }
    imageCount.sent += 1;
    return "[Billede " + imageCount.sent + "]";
  }

  const heading = /^h([1-6])$/.exec(tag);
  if (heading) {
    return "\n" + "#".repeat(Number(heading[1])) + " " + inner().trim() + "\n";
  }

  if (tag === "li") return "- " + inner().trim() + "\n";
  if (tag === "p") return "\n" + inner().trim() + "\n";

  if (tag === "table") {
    const rows = Array.from(element.querySelectorAll("tr"));
    if (rows.length === 0) return "";
    const cellsOf = (row: Element) =>
      Array.from(row.querySelectorAll("th, td")).map((cell) =>
        // a line break inside a cell would break the table so flatten it
        nodeToMarkdown(cell, imageCount).replace(/\s+/g, " ").trim(),
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

// Draws the first page of a Word document and hands it back as a small
// picture, the same way a pdf gets one. docx-preview does the drawing and
// html-to-image turns the drawn page into a picture. Both are already used
// elsewhere in the app.
async function renderDocxPreview(file: File): Promise<string> {
  if (file.size > MAX_DOCX_PREVIEW_SIZE) return "";
  const [docx, htmlToImage] = await Promise.all([
    import("docx-preview"),
    import("html-to-image"),
  ]);
  // The page has to sit in the real page to be measured and drawn, so it is
  // put just off the side of the screen where nobody sees it.
  const holder = document.createElement("div");
  holder.style.position = "fixed";
  holder.style.left = "-10000px";
  holder.style.top = "0";
  document.body.appendChild(holder);
  try {
    await docx.renderAsync(file, holder, undefined, { useBase64URL: true });
    // each page is its own section so the first one is the front page
    const page = holder.querySelector("section");
    if (!page || !page.offsetWidth) return "";
    const scale = PREVIEW_WIDTH / page.offsetWidth;
    return await htmlToImage.toJpeg(page, {
      quality: 0.7,
      backgroundColor: "#ffffff",
      canvasWidth: PREVIEW_WIDTH,
      canvasHeight: Math.round(page.offsetHeight * scale),
    });
  } finally {
    holder.remove();
  }
}

// Reads a Word document. A .docx is a zip file containing Word's own XML
// format, so it goes through a few steps to become text the model can read:
// mammoth turns that XML into an HTML string, the HTML string is parsed into
// a DOM tree, and the DOM tree is turned into markdown (see nodeToMarkdown),
// so tables and headings will still make it to the model.
// Pictures are replaced with text in that markdown, [Billede i] where i is the
// image number, and the images themselves are stored separately, in "images",
// instead of inside the text. The model can only receive a picture as an
// actual image input, not as text, so it has to be sent as its own message
// part seperated from the text but with [Billede i] showing its locaiton in the text.
async function extractDocx(
  file: File,
): Promise<{ text: string; images: string[]; preview: string }> {
  const mammoth = await import("mammoth");
  const { compressImage } = await import("./chat");

  const images: string[] = [];
  let usedImageTextLength = 0;
  let warnedAboutImageBudget = false;
  const result = await mammoth.convertToHtml(
    { arrayBuffer: await file.arrayBuffer() },
    {
      convertImage: mammoth.images.imgElement(async (image) => {
        if (usedImageTextLength < MAX_DOCX_IMAGE_TEXT_LENGTH) {
          try {
            const buffer = await image.readAsArrayBuffer();
            const asFile = new File([buffer], "billede", {
              type: image.contentType,
            });
            const small = await compressImage(asFile, MAX_DOCX_IMAGE_SIZE);
            images.push(small);
            usedImageTextLength += small.length;
            return { src: SENT_IMAGE_SRC };
          } catch {
            // a picture we cannot read is simply left out
          }
        } else if (!warnedAboutImageBudget) {
          // only once per file, so a document with hundreds of skipped
          // pictures doesn't flood the console with the same message
          warnedAboutImageBudget = true;
          console.warn(
            `[docx] hit the ${MAX_DOCX_IMAGE_TEXT_LENGTH} byte image budget in "${file.name}"; remaining pictures are left out`,
          );
        }
        // not sent, so nodeToMarkdown marks it as left out
        return { src: "" };
      }),
    },
  );

  const root = new DOMParser().parseFromString(result.value, "text/html").body;
  const text = nodeToMarkdown(root, { sent: 0 })
    // three or more blank lines in a row read badly so cut them down to one
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  // A file without a front page picture still attaches. It just gets the plain
  // badge like it did before.
  let preview = "";
  try {
    preview = await renderDocxPreview(file);
  } catch {
    preview = "";
  }

  return { text: text.slice(0, MAX_TEXT_LENGTH), images, preview };
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
  // Word files from before 2007 (.doc) are a different, older file format
  // that a browser cannot open. Give a clear next step here instead of the
  // generic "not supported" message below.
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
  await saveFileBlob(id, file);

  if (isPdf || isWord) {
    // If reading the file fails we still attach it (you can still open it); the
    // model just won't get the text and there won't be a preview picture.
    let text = "";
    let images: string[] = [];
    let preview = "";
    try {
      const read = isPdf ? extractPdf : extractDocx;
      ({ text, images, preview } = await read(file));
    } catch {
      text = "";
    }
    const type = isPdf ? "application/pdf" : DOCX_MIME;
    return { name: file.name, mime: type, id, text, images, preview };
  }

  const text = (await file.text()).slice(0, MAX_TEXT_LENGTH);
  return { name: file.name, mime: mime || "text/plain", id, text };
}
