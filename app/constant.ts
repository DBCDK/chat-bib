import { modelNames } from "@/app/dbc";
import { env } from "@/app/utils/appsettings";
export const OWNER = "";
export const REPO = "";
export const REPO_URL = `https://github.com/${OWNER}/${REPO}`;
export const ISSUE_URL = `https://github.com/${OWNER}/${REPO}/issues`;
export const UPDATE_URL = `${REPO_URL}#keep-updated`;
export const RELEASE_URL = `${REPO_URL}/releases`;
export const FETCH_COMMIT_URL = `https://api.github.com/repos/${OWNER}/${REPO}/commits?per_page=1`;
export const FETCH_TAG_URL = `https://api.github.com/repos/${OWNER}/${REPO}/tags?per_page=1`;
export const RUNTIME_CONFIG_DOM = "danger-runtime-config";

export const DEFAULT_API_HOST = "https://api.nextchat.dev";
export const OPENAI_BASE_URL = "https://api.openai.com";
export const ANTHROPIC_BASE_URL = "https://api.anthropic.com";

export const GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/";

export const MALICIOUS_ANSWER = `Jeg kan desværre ikke fortsætte samtalen, da den er på vej ind på et følsomt område. Hvis du er i krise eller har tanker om selvmord, så sig det til nogen, der ikke selv er selvmordstruet. Det hjælper at få sat ord på de svære tanker, og du kan gøre det anonymt.   

Du kan kontakte Livslinien på 70 201 201, chatte på livslinien.dk eller få netrådgivning på skrivdet.dk. Udover Livslinien kan du også få rådgivning hos Startlinjen, Psykiatrifonden, Sct. Nicolai Tjenesten og Børns Vilkår.`;

export enum Path {
  Home = "/",
  Chat = "/chat",
  Settings = "/settings",
  NewChat = "/new-chat",
  Masks = "/masks",
  Auth = "/auth",
}

export enum ApiPath {
  Cors = "",
  OpenAI = "/api/openai",
  Anthropic = "/api/anthropic",
}

export enum SlotID {
  AppBody = "app-body",
  CustomModel = "custom-model",
}

export enum FileName {
  Masks = "masks.json",
  Prompts = "prompts.json",
}

export enum StoreKey {
  Chat = "chat-next-web-store",
  Access = "access-control",
  Config = "app-config",
  Mask = "mask-store",
  Prompt = "prompt-store",
  Update = "chat-update",
  Sync = "sync",
}

export const DEFAULT_SIDEBAR_WIDTH = 300;
export const MAX_SIDEBAR_WIDTH = 500;
export const MIN_SIDEBAR_WIDTH = 240;
export const NARROW_SIDEBAR_WIDTH = 270;

export const ACCESS_CODE_PREFIX = "nk-";

export const LAST_INPUT_KEY = "last-input";
export const UNFINISHED_INPUT = (id: string) => "unfinished-input-" + id;

export const STORAGE_KEY = "chatgpt-next-web";

export const REQUEST_TIMEOUT_MS = 60000;

export const EXPORT_MESSAGE_CLASS_NAME = "export-markdown";

export enum ServiceProvider {
  OpenAI = "OpenAI",
  Azure = "Azure",
  Google = "Google",
  Anthropic = "Anthropic",
}

export enum ModelProvider {
  GPT = "GPT",
  GeminiPro = "GeminiPro",
  Claude = "Claude",
  TGI = "TGI",
  DBC = "DBC",
}

export const Anthropic = {
  ChatPath: "v1/messages",
  ChatPath1: "v1/complete",
  ExampleEndpoint: "https://api.anthropic.com",
  Vision: "2023-06-01",
};

export const OpenaiPath = {
  ChatPath: "v1/chat/completions",
  UsagePath: "dashboard/billing/usage",
  SubsPath: "dashboard/billing/subscription",
  ListModelPath: "v1/models",
};

export const Azure = {
  ExampleEndpoint: "https://{resource-url}/openai/deployments/{deploy-id}",
};

export const Google = {
  ExampleEndpoint: "https://generativelanguage.googleapis.com/",
  ChatPath: (modelName: string) => `v1beta/models/${modelName}:generateContent`,
};

export const DEFAULT_INPUT_TEMPLATE = `{{input}}`; // input / time / model / lang
// export const DEFAULT_SYSTEM_TEMPLATE = `
// You are ChatGPT, a large language model trained by {{ServiceProvider}}.
// Knowledge cutoff: {{cutoff}}
// Current model: {{model}}
// Current time: {{time}}
// Latex inline: $x^2$
// Latex block: $$e=mc^2$$
// `;
export const DEFAULT_SYSTEM_TEMPLATE = `
You are ChatGPT, a large language model trained by {{ServiceProvider}}.
Knowledge cutoff: {{cutoff}}
Current model: {{model}}
Current time: {{time}}
Latex inline: \\(x^2\\) 
Latex block: $$e=mc^2$$
`;

export const SUMMARIZE_MODEL = "gpt-3.5-turbo";
export const GEMINI_SUMMARIZE_MODEL = "gemini-pro";

export const KnowledgeCutOffDate: Record<string, string> = {
  default: "2021-09",
  "gpt-4-turbo": "2023-12",
  "gpt-4-turbo-2024-04-09": "2023-12",
  "gpt-4-turbo-preview": "2023-12",
  "gpt-4o": "2023-10",
  "gpt-4o-2024-05-13": "2023-10",
  "gpt-4-vision-preview": "2023-04",
  // After improvements,
  // it's now easier to add "KnowledgeCutOffDate" instead of stupid hardcoding it, as was done previously.
  "gemini-pro": "2023-12",
  "gemini-pro-vision": "2023-12",
  tgi: "2023-12",
};

export let DEFAULT_MODELS = [
  ...modelNames.map((name) => ({
    name,
    available: true,
    provider: {
      id: "dbc",
      providerName: "DBC",
      providerType: "openai",
    },
  })),
];
if (env.DISABLE_MODELS) {
  DEFAULT_MODELS = [];
}

// DBC simple search speed configuration
export enum SearchSpeed {
  Fast = "fast",
  Slow = "slow",
}

export const CHAT_PAGE_SIZE = 15;
export const MAX_RENDER_MSG_COUNT = 45;

// some famous webdav endpoints
export const internalAllowedWebDavEndpoints = [
  "https://dav.jianguoyun.com/dav/",
  "https://dav.dropdav.com/",
  "https://dav.box.com/dav",
  "https://nanao.teracloud.jp/dav/",
  "https://bora.teracloud.jp/dav/",
  "https://webdav.4shared.com/",
  "https://dav.idrivesync.com",
  "https://webdav.yandex.com",
  "https://app.koofr.net/dav/Koofr",
];

// Each key is a stable alias for the DBC LLM endpoint.
// Set hiddenFromUi: true for aliases used internally but not shown in chat options.
export const DBC_LLM_ENDPOINT_MODEL_CONFIG = {
  chatbib: {
    label: "chatbib(gemma3-12b)",
    model: "google/gemma-3-12b-it",
  },
  "mistral-3.1":{
    label: "Mistral 3.1",
    model: "mistral/Mistral-Small-3.1-24B-Instruct",
  },
  "fakta-chat": {
    label: "fakta-chat",
    model: "fakta-chat",
    hiddenFromUi: true,
  },
  "malicious-guard": {
    label: "malicious-guard",
    model: "mistral/Mistral-Small-3.1-24B-Instruct",
    hiddenFromUi: true,
  },
} as const;

export type DbcLlmEndpointModel = keyof typeof DBC_LLM_ENDPOINT_MODEL_CONFIG;

export const DBC_LLM_ENDPOINT_MODELS = Object.keys(
  DBC_LLM_ENDPOINT_MODEL_CONFIG,
) as DbcLlmEndpointModel[];

export const VISIBLE_DBC_LLM_ENDPOINT_MODELS = DBC_LLM_ENDPOINT_MODELS.filter(
  (model) => !("hiddenFromUi" in DBC_LLM_ENDPOINT_MODEL_CONFIG[model]),
);
