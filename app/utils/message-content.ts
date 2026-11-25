import type {
  FileAttachment,
  MultimodalContent,
  RequestMessage,
} from "../client/api";
import { MessageRole } from "../typing";

export function getMessageTextContent(message: RequestMessage) {
  if (typeof message.content === "string") {
    return message.content;
  }
  for (const c of message.content) {
    if (c.type === "text") {
      return c.text ?? "";
    }
  }
  return "";
}

export function getMessageImages(message: RequestMessage): string[] {
  if (typeof message.content === "string") {
    return [];
  }
  const urls: string[] = [];
  for (const c of message.content) {
    if (c.type === "image_url") {
      urls.push(c.image_url?.url ?? "");
    }
  }
  return urls;
}

// The file names of the images in a message. Same order as getMessageImages.
// A pasted image or one from an older chat has no name and gives an empty
// string. Used for the hover text and the preview title.
export function getMessageImageNames(message: RequestMessage): string[] {
  if (typeof message.content === "string") {
    return [];
  }
  const names: string[] = [];
  for (const c of message.content) {
    if (c.type === "image_url") {
      names.push(c.image_url?.name ?? "");
    }
  }
  return names;
}

// The files attached to a message that are not images.
export function getMessageFiles(message: RequestMessage): FileAttachment[] {
  if (typeof message.content === "string") {
    return [];
  }
  const files: FileAttachment[] = [];
  for (const c of message.content) {
    if (c.type === "file" && c.file) {
      files.push(c.file);
    }
  }
  return files;
}

// Takes the PDFs that are sent as page pictures out of the messages. A title
// or summary request never loads those pictures. Without this the request
// builder would report such a PDF as left out for lack of room. Other files
// and the pupil's own pictures stay.
export function withoutPagePdfs<T extends RequestMessage>(messages: T[]): T[] {
  return messages.map((message) => {
    if (typeof message.content === "string") return message;
    const content = message.content.filter(
      (part) => !(part.type === "file" && part.file?.pdfPageCount),
    );
    return content.length === message.content.length
      ? message
      : ({ ...message, content } as T);
  });
}

// How many tokens the files and pictures of one request may use together. The
// pupil's own words and the chat history are not counted here.
export const MATERIAL_TOKEN_BUDGET = 22000;
// What a picture is counted as when its real cost is not known.
const IMAGE_TOKENS = 300;

// Rough token count used to fit attachments into one request. Real text
// usually counts lower than this so the estimate stays on the safe side.
export function textTokens(text: string): number {
  let tokens = 0;
  for (let i = 0; i < text.length; i += 1) {
    const code = text.charCodeAt(i);
    const letter = (code >= 65 && code <= 90) || (code >= 97 && code <= 122);
    tokens += code > 127 ? 1.2 : letter ? 0.25 : 1;
  }
  return tokens;
}

export function imageCost(tokens?: number): number {
  return typeof tokens === "number" && Number.isFinite(tokens) && tokens > 0
    ? tokens
    : IMAGE_TOKENS;
}

function highestPictureNumber(text: string): number {
  let highest = 0;
  for (const mark of text.matchAll(/\[Billede (\d+)\]/g)) {
    highest = Math.max(highest, Number(mark[1]));
  }
  return highest;
}

function filePart(
  file: FileAttachment,
  name: string,
  text: string,
  pictures: number,
  sent: number,
): string {
  if (file.pdfPageCount) {
    // The saved text of such a PDF is not sent. Its page marks are for the
    // app's own use. The model gets a caption with each page picture.
    const availability =
      sent < file.pdfPageCount
        ? `Kun de første ${sent} af ${file.pdfPageCount} sider er med. Resten er ikke tilgængelig.\n`
        : "";
    return (
      `Uploadet materiale "${name}":\n${availability}` +
      "Sidetallene nedenfor følger rækkefølgen i PDF-filen. Brug dem, når du henviser til dokumentets sider.\n"
    );
  }
  let note = "";
  if (file.text?.includes("[Billede ")) {
    if (sent === 0)
      note = "Billederne fra filen er ikke vedhæftet her, kun teksten.\n";
    else if (sent < (file.imageCount ?? pictures))
      note = `Billede 1 til ${sent} fra filen er vedhæftet for sig efter teksten. Resten er ikke vedhæftet.\n`;
    else
      note =
        "Billederne fra filen er vedhæftet for sig efter teksten og nummereret. [Billede N] i teksten viser, hvor billede N hører til.\n";
  }
  if (text.length < (file.text?.length ?? 0))
    note +=
      "Der er ikke plads til hele filen her, så kun begyndelsen er med. Sig det, hvis du bliver spurgt om resten.\n";
  return `Uploadet materiale "${name}":\n${note}${text}`;
}

function fitFileText(
  file: FileAttachment,
  name: string,
  pictureCosts: number[],
  room: number,
  count: (text: string) => number,
  countPart: (text: string, images: number) => number,
): { text: string; images: number } | undefined {
  if (room <= 0) return;
  const original = file.text ?? "";
  // The saved text of a page picture PDF is not sent. So it needs no room.
  const wantText = file.pdfPageCount ? 0 : count(original);
  const half = Math.floor(room / 2);
  const roomForPictures = room - Math.min(wantText, half);
  let imageLimit = 0;
  while (
    imageLimit + 1 < pictureCosts.length &&
    pictureCosts[imageLimit + 1] <= roomForPictures
  ) {
    imageLimit += 1;
  }

  function candidate(end: number) {
    // Do not cut between the two halves of a character like an emoji.
    if (end < original.length) {
      const last = original.charCodeAt(end - 1);
      if (last >= 0xd800 && last <= 0xdbff) end -= 1;
    }
    let text = original.slice(0, end);
    if (end < original.length) {
      const pageEnd = text.lastIndexOf("\n\n");
      if (pageEnd > text.length * 0.9) text = text.slice(0, pageEnd);
      // Do not leave half a picture mark at the end. A bracket that is not
      // part of a mark is normal text and stays.
      const bracket = text.lastIndexOf("[");
      const mark =
        bracket < 0 ? null : /^\[Billede \d+\]/.exec(original.slice(bracket));
      if (mark && bracket + mark[0].length > text.length)
        text = text.slice(0, bracket);
    }
    const images = Math.min(imageLimit, highestPictureNumber(text));
    const cost = countPart(
      filePart(file, name, text, pictureCosts.length - 1, images),
      images,
    );
    return { text, images, cost };
  }

  let whole = candidate(original.length);
  // A short text is never cut to make room for pictures. Send one picture
  // fewer until it all fits.
  while (wantText <= half && whole.cost > room && imageLimit > 0) {
    imageLimit -= 1;
    whole = candidate(original.length);
  }
  if (whole.cost <= room) return whole;
  let low = 0;
  let high = original.length - 1;
  let fit: ReturnType<typeof candidate> | undefined;
  // Search for the longest start of the text that fits. Each try is counted
  // as a whole because one token can cover several characters.
  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    const next = candidate(mid);
    if (next.cost <= room) {
      if (next.text) fit = next;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }
  return fit;
}

// Tells the attach button how much room is left and how much of each file
// would be sent. It runs the real request builder on a copy. So headings and
// notes and cuts are counted exactly as in a real request. The copy has no
// picture data and is never sent.
export type AttachmentCoverage = {
  remaining: number;
  files: { images: number; included: boolean }[];
};

export function getAttachmentCoverage(
  files: FileAttachment[],
  pictureCount: number | number[],
  countTokens?: (text: string) => number,
): AttachmentCoverage {
  const costs = Array.isArray(pictureCount)
    ? pictureCount.map(imageCost)
    : Array(pictureCount).fill(IMAGE_TOKENS);
  const content: MultimodalContent[] = costs.map((tokens) => ({
    type: "image_url",
    image_url: { url: "", tokens },
  }));
  for (const file of files) {
    content.push({
      type: "file",
      file: {
        ...file,
        // Old chats have no picture count. Count the pictures saved in them.
        images: Array(file.imageCount ?? file.images?.length ?? 0).fill(""),
      },
    });
  }
  const budget = { remaining: MATERIAL_TOKEN_BUDGET };
  const coverage: AttachmentCoverage["files"] = [];
  getMessageContentForApi(
    { role: MessageRole.User, content },
    true,
    new Set(),
    budget,
    countTokens,
    coverage,
  );
  return { remaining: budget.remaining, files: coverage };
}

export function isAttachmentBudgetFull(
  files: FileAttachment[],
  pictureCount: number | number[],
  countTokens?: (text: string) => number,
): boolean {
  if (files.length === 0) {
    const costs = Array.isArray(pictureCount)
      ? pictureCount.map(imageCost)
      : Array(pictureCount).fill(IMAGE_TOKENS);
    return (
      costs.reduce((total, cost) => total + cost, 0) >= MATERIAL_TOKEN_BUDGET
    );
  }
  return getAttachmentCoverage(files, pictureCount, countTokens).remaining <= 0;
}

// Builds what is sent to the model for one message. The text of attached
// files is added to the message text because the model cannot open a file.
// Pictures are kept when keepImages is true. Without pictures the result is a
// plain string.
//
// Share one "seenFileTexts" set across a request so each file is sent only
// once. Share one "budget" and start with the newest message. The newest file
// then gets room first and older text and pictures are cut or left out.
export function getMessageContentForApi(
  message: RequestMessage,
  keepImages = true,
  seenFileTexts?: Set<string>,
  budget?: { remaining: number },
  countTokens?: (text: string) => number,
  coverage?: AttachmentCoverage["files"],
): string | MultimodalContent[] {
  if (typeof message.content === "string") {
    return message.content;
  }
  const count = countTokens ?? textTokens;
  let text = getMessageTextContent(message);
  const materialParts: string[] = [];
  let materialCost = 0;
  let pictureCost = 0;
  let firstCaption = "";
  // the pictures from the files. Each one follows a line that says which it is
  const filePictures: MultimodalContent[] = [];
  // how many files this message tried to send. Shows how many did not fit
  let tried = 0;
  // The pupil's own pictures are sent again with every request. They get room
  // before the files do. The ones that do not fit are left out.
  const ownParts = keepImages
    ? message.content.filter((part) => part.type === "image_url")
    : [];
  const ownPictures = ownParts.map((part) => part.image_url?.url ?? "");
  const own = ownPictures.length;
  let ownSent = 0;
  for (const part of ownParts) {
    const cost = imageCost(part.image_url?.tokens);
    if (budget && cost > budget.remaining) break;
    ownSent += 1;
    if (budget) budget.remaining -= cost;
  }
  for (const f of getMessageFiles(message)) {
    const covered = { images: 0, included: false };
    coverage?.push(covered);
    if (!f.text) continue;
    // A PDF sent as page pictures is no use to a request without pictures.
    // Leave it out without a note about missing room.
    if (f.pdfPageCount && !keepImages) continue;
    let name = f.name;
    if (seenFileTexts) {
      // Send each file only once per request. A pinned message is in the
      // request twice. Files are told apart by id because two scans can have
      // the same name and the same text.
      const seenKey = `${f.name}\n${f.id ?? f.text}`;
      if (seenFileTexts.has(seenKey)) continue;
      seenFileTexts.add(seenKey);
      // Two files can have the same name. Number the second one so the model
      // can tell which file a picture came from.
      const sameName = Array.from(seenFileTexts).filter((k) =>
        k.startsWith(`${f.name}\n`),
      ).length;
      if (sameName > 1) name = `${f.name} (${sameName})`;
    }
    tried += 1;
    const pictures = (keepImages && f.images) || [];
    let fileText = f.text;
    let sendPictures = pictures.length;
    // Each picture gets a caption. Only the first one names the file because a
    // long file name on every page would cost room for several pages. A page
    // number is only read from a mark that starts a paragraph.
    const captions = pictures.map((_, i) => {
      const n = i + 1;
      const page = new RegExp(
        `(?:^|\\n\\n)Side (\\d+) \\[Billede ${n}\\]`,
      ).exec(fileText);
      const from = i === 0 ? ` fra "${name}"` : "";
      if (f.pdfPageCount) return `Side ${page?.[1] ?? n}${from}:`;
      return page
        ? `Billede ${n}${from} (side ${page[1]}):`
        : `Billede ${n}${from}:`;
    });
    const pictureCosts = [0];
    for (let i = 0; i < pictures.length; i += 1) {
      const cost = imageCost(f.imageTokens?.[i]) + count(captions[i]);
      pictureCosts.push(pictureCosts[i] + cost);
    }
    const previous = materialParts.join("\n\n");
    const countPart = (part: string, images: number) => {
      // The server trims the end of the text the way Python does. That removes
      // these characters but keeps U+FEFF. Count the text the same way.
      const combined = previous ? `${previous}\n\n${part}` : part;
      let end = combined.length;
      while (
        end > 0 &&
        /[\p{White_Space}\u001c-\u001f]/u.test(combined[end - 1])
      )
        end -= 1;
      const joined = combined.slice(0, end);
      // When none of the pupil's own pictures is sent the first caption comes
      // right after the text. The two are then counted as one text.
      const caption = firstCaption || (images > 0 ? captions[0] : "");
      const mergeCaption = ownSent === 0 && caption;
      return (
        count(joined + (mergeCaption || "")) +
        pictureCost +
        pictureCosts[images] -
        (mergeCaption ? count(caption) : 0) -
        materialCost
      );
    };
    if (budget) {
      const fit = fitFileText(
        f,
        name,
        pictureCosts,
        budget.remaining,
        count,
        countPart,
      );
      if (!fit) continue;
      fileText = fit.text;
      sendPictures = fit.images;
    }
    // Only send pictures that the text still has a mark for. Without a mark
    // nothing tells the model where a picture belongs. The highest mark number
    // decides because a text can point back to an earlier picture.
    sendPictures = Math.min(sendPictures, highestPictureNumber(fileText));
    // No page of the PDF fits. Skip it so it counts as left out for lack of
    // room.
    if (f.pdfPageCount && sendPictures === 0) continue;
    // Nothing of the file fits. A heading alone would say nothing so skip it.
    if (!fileText && sendPictures === 0) continue;
    const part = filePart(f, name, fileText, pictures.length, sendPictures);
    // the heading and the note cost tokens too and add up with many files
    const cost = countPart(part, sendPictures);
    if (budget) budget.remaining -= cost;
    materialCost += cost;
    pictureCost += pictureCosts[sendPictures];
    if (!firstCaption && sendPictures > 0) firstCaption = captions[0];
    materialParts.push(part);
    covered.images = sendPictures;
    covered.included = true;
    for (let n = 1; n <= sendPictures; n += 1) {
      filePictures.push(
        { type: "text", text: captions[n - 1] },
        { type: "image_url", image_url: { url: pictures[n - 1] } },
      );
    }
  }
  const materials = materialParts.join("\n\n");
  if (materials) {
    text = text ? `${text}\n\n${materials}` : materials;
  }
  if (ownSent < own) {
    text += `\n\n(${own - ownSent} af billederne i denne besked er ikke sendt med igen.)`;
  }
  // Tell the model when a file was left out so it does not answer as if it
  // had read it.
  const leftOutFiles = tried - materialParts.length;
  if (leftOutFiles > 0) {
    text += `\n\n(${leftOutFiles} af filerne i denne besked er ikke sendt med, fordi der ikke er plads.)`;
  }
  // send only the picture. The file name is just for the screen
  const images = ownPictures.slice(0, ownSent).map((url) => ({
    type: "image_url" as const,
    image_url: { url },
  }));
  const parts = [...images, ...filePictures];
  if (parts.length === 0) {
    return text;
  }
  return [{ type: "text", text }, ...parts];
}

// Builds the content for every message. It starts with the newest message so
// the newest file gets room first. Returns one entry per message in the same
// order. Both clients use this so the rules are in one place.
export function foldContentsForApi(
  messages: RequestMessage[],
  keepImages: boolean,
  countTokens?: (text: string) => number,
): (string | MultimodalContent[])[] {
  const seenFileTexts = new Set<string>();
  const budget = { remaining: MATERIAL_TOKEN_BUDGET };
  const contents = new Array<string | MultimodalContent[]>(messages.length);
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    contents[i] = getMessageContentForApi(
      messages[i],
      keepImages,
      seenFileTexts,
      budget,
      countTokens,
    );
  }
  return contents;
}
