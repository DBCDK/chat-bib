import { useEffect, useState } from "react";
import { showToast } from "./components/ui-lib";
import Locale from "./locales";
import { FileAttachment, MultimodalContent, RequestMessage } from "./client/api";

export function trimTopic(topic: string) {
  // Fix an issue where double quotes still show in the Indonesian language
  // This will remove the specified punctuation from the end of the string
  // and also trim quotes from both the start and end if they exist.
  return (
    topic
      // fix for gemini
      .replace(/^["“”*]+|["“”*]+$/g, "")
      .replace(/[，。！？”“"、,.!?*]*$/, "")
  );
}

export async function copyToClipboard(text: string) {
  try {
    await navigator.clipboard.writeText(text);

    showToast(Locale.Copy.Success);
  } catch (error) {
    const textArea = document.createElement("textarea");
    textArea.value = text;
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    try {
      document.execCommand("copy");
      showToast(Locale.Copy.Success);
    } catch (error) {
      showToast(Locale.Copy.Failed);
    }
    document.body.removeChild(textArea);
  }
}

export async function downloadAs(text: string, filename: string) {
  const element = document.createElement("a");
  element.setAttribute(
    "href",
    "data:text/plain;charset=utf-8," + encodeURIComponent(text),
  );
  element.setAttribute("download", filename);

  element.style.display = "none";
  document.body.appendChild(element);

  element.click();

  document.body.removeChild(element);
}

export function readFromFile() {
  return new Promise<string>((res, rej) => {
    const fileInput = document.createElement("input");
    fileInput.type = "file";
    fileInput.accept = "application/json";

    fileInput.onchange = (event: any) => {
      const file = event.target.files[0];
      const fileReader = new FileReader();
      fileReader.onload = (e: any) => {
        res(e.target.result);
      };
      fileReader.onerror = (e) => rej(e);
      fileReader.readAsText(file);
    };

    fileInput.click();
  });
}

export function isIOS() {
  const userAgent = navigator.userAgent.toLowerCase();
  return /iphone|ipad|ipod/.test(userAgent);
}

export function useWindowSize() {
  const [size, setSize] = useState({
    width: window.innerWidth,
    height: window.innerHeight,
  });

  useEffect(() => {
    const onResize = () => {
      setSize({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    };

    window.addEventListener("resize", onResize);

    return () => {
      window.removeEventListener("resize", onResize);
    };
  }, []);

  return size;
}

export const MOBILE_MAX_WIDTH = 600;
export function useMobileScreen() {
  const { width } = useWindowSize();

  return width <= MOBILE_MAX_WIDTH;
}

export function isFirefox() {
  return (
    typeof navigator !== "undefined" && /firefox/i.test(navigator.userAgent)
  );
}

export function selectOrCopy(el: HTMLElement, content: string) {
  const currentSelection = window.getSelection();

  if (currentSelection?.type === "Range") {
    return false;
  }

  copyToClipboard(content);

  return true;
}

function getDomContentWidth(dom: HTMLElement) {
  const style = window.getComputedStyle(dom);
  const paddingWidth =
    parseFloat(style.paddingLeft) + parseFloat(style.paddingRight);
  const width = dom.clientWidth - paddingWidth;
  return width;
}

function getOrCreateMeasureDom(id: string, init?: (dom: HTMLElement) => void) {
  let dom = document.getElementById(id);

  if (!dom) {
    dom = document.createElement("span");
    dom.style.position = "absolute";
    dom.style.wordBreak = "break-word";
    dom.style.fontSize = "14px";
    dom.style.transform = "translateY(-200vh)";
    dom.style.pointerEvents = "none";
    dom.style.opacity = "0";
    dom.id = id;
    document.body.appendChild(dom);
    init?.(dom);
  }

  return dom!;
}

export function autoGrowTextArea(dom: HTMLTextAreaElement) {
  const measureDom = getOrCreateMeasureDom("__measure");
  const singleLineDom = getOrCreateMeasureDom("__single_measure", (dom) => {
    dom.innerText = "TEXT_FOR_MEASURE";
  });

  const width = getDomContentWidth(dom);
  measureDom.style.width = width + "px";
  measureDom.innerText = dom.value !== "" ? dom.value : "1";
  measureDom.style.fontSize = dom.style.fontSize;
  const endWithEmptyLine = dom.value.endsWith("\n");
  const height = parseFloat(window.getComputedStyle(measureDom).height);
  const singleLineHeight = parseFloat(
    window.getComputedStyle(singleLineDom).height,
  );

  const rows =
    Math.round(height / singleLineHeight) + (endWithEmptyLine ? 1 : 0);

  return rows;
}

export function getCSSVar(varName: string) {
  return getComputedStyle(document.body).getPropertyValue(varName).trim();
}

/**
 * Detects Macintosh
 */
export function isMacOS(): boolean {
  if (typeof window !== "undefined") {
    let userAgent = window.navigator.userAgent.toLocaleLowerCase();
    const macintosh = /iphone|ipad|ipod|macintosh/.test(userAgent);
    return !!macintosh;
  }
  return false;
}

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

// The file names of a message's images, in the same order as getMessageImages.
// Empty string when an image has no name (e.g. pasted images or older chats).
// Used for the hover text and the preview title.
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

// The non-image files (pdf, text, ...) attached to a message.
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

// The most characters of file text we put in one request. Same limit the demo
// uses. It stops several big files (or the same file sent again and again) from
// making the request too big for the model, which makes the server send nothing
// back.
export const MATERIAL_CHAR_BUDGET = 60000;

// Builds what we actually send to the model for one message: adds any attached
// files' text into the text (the model can't read the file itself), and keeps
// images when keepImages is true. Returns a plain string when there are no
// images.
//
// Pass a shared `seenFileTexts` set for a whole request so the same file's text
// is added only once (the model already saw it in an earlier message). Pass a
// shared `budget` (start with the newest message) to limit how much file text
// goes in one request: the newest file gets the room first, and older text is
// cut short or left out. Together these stop big or many files from making the
// request too big (which makes the server send nothing back).
export function getMessageContentForApi(
  message: RequestMessage,
  keepImages = true,
  seenFileTexts?: Set<string>,
  budget?: { remaining: number },
): string | MultimodalContent[] {
  if (typeof message.content === "string") {
    return message.content;
  }
  let text = getMessageTextContent(message);
  const materialParts: string[] = [];
  for (const f of getMessageFiles(message)) {
    if (!f.text) continue;
    // add each file's text only once per request
    if (seenFileTexts) {
      if (seenFileTexts.has(f.text)) continue;
      seenFileTexts.add(f.text);
    }
    // limit the total file text per request; skip once there's no room left
    let fileText = f.text;
    if (budget) {
      if (budget.remaining <= 0) continue;
      if (fileText.length > budget.remaining) {
        fileText = fileText.slice(0, budget.remaining);
      }
      budget.remaining -= fileText.length;
    }
    materialParts.push(`Uploadet materiale "${f.name}":\n${fileText}`);
  }
  const materials = materialParts.join("\n\n");
  if (materials) {
    text = text ? `${text}\n\n${materials}` : materials;
  }
  const images = keepImages
    ? message.content
        .filter((c) => c.type === "image_url")
        // send only the image itself; the file name is just for the screen
        .map((c) => ({
          type: "image_url" as const,
          image_url: { url: c.image_url?.url ?? "" },
        }))
    : [];
  if (images.length === 0) {
    return text;
  }
  return [{ type: "text", text }, ...images];
}

// Builds the content for every message, newest first, so the newest file gets
// the shared text room first. Returns one entry per message, in order. Both
// clients use this so the "add once" and "limit" rules live in one place.
export function foldContentsForApi(
  messages: RequestMessage[],
  keepImages: boolean,
): (string | MultimodalContent[])[] {
  const seenFileTexts = new Set<string>();
  const budget = { remaining: MATERIAL_CHAR_BUDGET };
  const contents = new Array<string | MultimodalContent[]>(messages.length);
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    contents[i] = getMessageContentForApi(
      messages[i],
      keepImages,
      seenFileTexts,
      budget,
    );
  }
  return contents;
}

export function isVisionModel(model: string) {
  // Note: This is a better way using the TypeScript feature instead of `&&` or `||` (ts v5.5.0-dev.20240314 I've been using)

  const visionKeywords = [
    "vision",
    "claude-3",
    "gemini-1.5-pro",
    "gemini-1.5-flash",
    "gpt-4o",
    // enable the attach button for skolegpt/dbc models. requests that contain an
    // image are routed to an image-capable model (env.IMAGE_MODEL) in openai.ts.
    "dbc",
    "gemma",
    "chatbib",
    "skolegpt-v3",
  ];
  const isGpt4Turbo =
    model.includes("gpt-4-turbo") && !model.includes("preview");

  return (
    visionKeywords.some((keyword) => model.includes(keyword)) || isGpt4Turbo
  );
}

//track maotmo event
export const trackMatomoEvent = (
  category: string,
  action: string,
  name?: string,
): void => {
  if (typeof window !== "undefined" && window._paq) {
    window._paq.push(["trackEvent", category, action, name]);
  }
};
