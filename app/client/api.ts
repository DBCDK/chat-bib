import {
  ACCESS_CODE_PREFIX,
  ModelProvider,
  ServiceProvider,
} from "../constant";
import { useAccessStore, useChatStore } from "../store";
import { DBCApi } from "./platforms/dbc";
import { ChatGPTApi } from "./platforms/openai";
import { MessageRole } from "../typing";
import { env } from "../utils/appsettings";
export const ROLES = ["system", "user", "assistant"] as const;
//export type MessageRole = (typeof ROLES)[number];

// A non-image attachment (pdf, text file, ...). The file itself is saved in
// IndexedDB under "id" (not in the chat history, so the history stays small);
// the viewer opens it by that id. "url" is an old-style inline file, still used
// for older chats and for images. "text" is the text we send to the model (it
// can't read the file itself); "preview" is a small preview picture.
export interface FileAttachment {
  name: string;
  mime: string;
  id?: string;
  url?: string;
  text?: string;
  preview?: string;
}

export interface MultimodalContent {
  type: "text" | "image_url" | "file";
  text?: string;
  image_url?: {
    url: string;
    // the image's file name, kept for the screen (hover text + preview title).
    // removed before we send the request to the model in getMessageContentForApi.
    name?: string;
  };
  file?: FileAttachment;
}

export interface RequestMessage {
  role: MessageRole;
  content: string | MultimodalContent[];
}

export interface LLMConfig {
  model: string;
  temperature?: number;
  top_p?: number;
  stream?: boolean;
  presence_penalty?: number;
  frequency_penalty?: number;
  // Optional endpoint-level model override for DBC LLM endpoint
  llmModel?: string;
}

export interface ChatOptions {
  messages: RequestMessage[];
  config: LLMConfig;

  onUpdate?: (message: string, chunk: string) => void;
  onFinish: (message: string) => void;
  onError?: (err: Error) => void;
  onController?: (controller: AbortController) => void;
  // Optional conversation id override (used for multi-llm children)
  conversationIdOverride?: string;
}

// A failure that is worth sending the message again for.
export class RetryableError extends Error {}

// The user pressed stop. There is nothing to tell them.
export class AbortedError extends Error {}

// Too much text for the model. Only a new chat helps.
export class TooLongError extends Error {}

const RETRYABLE_ERROR_TYPES = ["upstream_error", "server_error", "timeout"];

// The server puts failures inside a normal stream, like
// {"error":{"message":"...","type":"upstream_error","code":"request_failed"}}
export function toStreamError(error: any, httpStatus = 0) {
  // the whole thing, so we can see the type and the code and not just the text
  const message = error
    ? JSON.stringify(error, null, 2)
    : "unknown error from server";
  // the server names the field it could not fit
  if (error?.param === "input_tokens") {
    return new TooLongError(message);
  }
  const canRetry =
    RETRYABLE_ERROR_TYPES.includes(error?.type) ||
    Number(error?.code) >= 500 ||
    httpStatus >= 500;
  return canRetry ? new RetryableError(message) : new Error(message);
}

export interface LLMUsage {
  used: number;
  total: number;
}

export interface LLMModel {
  name: string;
  available: boolean;
  provider: LLMModelProvider;
}

export interface LLMModelProvider {
  id: string;
  providerName: string;
  providerType: string;
}

export abstract class LLMApi {
  abstract chat(options: ChatOptions): Promise<void>;
  abstract usage(): Promise<LLMUsage>;
  abstract models(): Promise<LLMModel[]>;
}

export class ClientApi {
  public llm: LLMApi;

  constructor(provider: ModelProvider = ModelProvider.GPT) {
    switch (provider) {
      case ModelProvider.DBC:
        this.llm = new DBCApi();
        break;

      default:
        this.llm = new ChatGPTApi();
    }
  }
}

export function getHeaders() {
  const accessStore = useAccessStore.getState();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
  };
  const isAzure = accessStore.provider === ServiceProvider.Azure;
  const authHeader = isAzure ? "api-key" : "Authorization";
  const envApiKey = env.API_KEY;
  const apiKey = envApiKey
    ? envApiKey
    : isAzure
      ? accessStore.azureApiKey
      : accessStore.openaiApiKey;
  const makeBearer = (s: string) => `${isAzure ? "" : "Bearer "}${s.trim()}`;
  const validString = (x: string) => x && x.length > 0;

  // use user's api key first
  if (validString(apiKey)) {
    headers[authHeader] = makeBearer(apiKey);
  } else if (
    accessStore.enabledAccessControl() &&
    validString(accessStore.accessCode)
  ) {
    headers[authHeader] = makeBearer(
      ACCESS_CODE_PREFIX + accessStore.accessCode,
    );
  }

  return headers;
}
