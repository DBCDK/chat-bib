import { ClientApi, MultimodalContent } from "../client/api";
import { ModelProvider } from "../constant";
import { MessageRole } from "../typing";
import { useAppConfig } from "../store/config";
import { env } from "./appsettings";
import { extractPdf, isImageFile } from "./attachment";

// A short note made from a file the user added to an assistant. Only the note
// is kept and the file itself is thrown away. That keeps the assistant small
// enough to be shared in a link.
export type MaskMaterial = {
  name: string;
  text: string;
};

// The most characters one note may take up. Kept small on purpose because the
// note has to fit in a share link next to the system prompt.
export const MAX_MATERIAL_CHARS = 500;

// Roughly how many characters of name plus prompt plus notes a share link can
// hold. Go past this and sharing can stop working. The QR code runs out of
// room first.
export const SHARE_CHAR_BUDGET = 1500;

// The most characters of file text we send to the model when asking for a note.
const MAX_INPUT_CHARS = 20000;

const IMAGE_QUESTION =
  "Beskriv kort og præcist hvad der er på billedet. Skriv al tekst du kan se. " +
  "Svar på dansk i højst 4 sætninger.";

const TEXT_QUESTION =
  "Skriv et kort resumé af teksten nedenfor. Nævn de vigtigste punkter. " +
  "Svar på dansk i højst 4 sætninger.";

// Asks the model one question and gives back the answer. Nothing is shown in
// the chat. This is the same way the app already makes its chat titles.
function askModel(
  content: string | MultimodalContent[],
  model: string,
): Promise<string> {
  const api = new ClientApi(
    model.startsWith("dbc") ? ModelProvider.DBC : ModelProvider.GPT,
  );
  return new Promise((resolve, reject) => {
    api.llm.chat({
      messages: [{ role: MessageRole.User, content }],
      config: { model, stream: false },
      onFinish: (message) => resolve(message ?? ""),
      onError: (err) => reject(err),
    });
  });
}

// Reads the text out of a pdf or a text file.
async function readFileText(file: File): Promise<string> {
  const ext = (file.name.split(".").pop() || "").toLowerCase();
  const isPdf = ext === "pdf" || file.type === "application/pdf";
  if (isPdf) return (await extractPdf(file)).text;
  return await file.text();
}

// Turns one file into a short note. Pictures are sent to the model as a
// picture. Everything else is sent as text.
export async function fileToMaterial(file: File): Promise<MaskMaterial> {
  // Use the model from the app settings first. The saved setting in the browser
  // can be an old model that the server no longer allows.
  const model =
    (env.DEFAULT_MODEL as string) ||
    useAppConfig.getState().modelConfig.model;
  let content: string | MultimodalContent[];

  if (isImageFile(file)) {
    // loaded only when it is needed because it only works in the browser and
    // this file is also read on the server
    const { compressImage } = await import("./chat");
    const url = await compressImage(file, 256 * 1024);
    content = [
      { type: "text", text: IMAGE_QUESTION },
      { type: "image_url", image_url: { url } },
    ];
  } else {
    const text = await readFileText(file);
    if (!text.trim()) {
      throw new Error("Der er ingen tekst at læse i filen.");
    }
    content = TEXT_QUESTION + "\n\n" + text.slice(0, MAX_INPUT_CHARS);
  }

  const answer = (await askModel(content, model)).trim();
  if (!answer) {
    // An empty answer usually means the request was turned down. That happens
    // for example when the model is not allowed. The model name is in the
    // message so it is easier to see what went wrong.
    console.error("Empty answer when reading file. Model used:", model);
    throw new Error(
      "Kunne ikke lave et resumé af filen. Modellen " +
        model +
        " svarede ikke. Se konsollen for detaljer.",
    );
  }
  return { name: file.name, text: answer.slice(0, MAX_MATERIAL_CHARS) };
}

// All the notes as one piece of text. Used both when we send them to the model
// and when we put them in a share link.
export function materialsToText(materials: MaskMaterial[]): string {
  return materials.map((m) => m.name + ": " + m.text).join("\n\n");
}
