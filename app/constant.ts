import { modelNames } from "@/app/dbc";
import { env } from "@/app/utils/appsettings";
export const RUNTIME_CONFIG_DOM = "danger-runtime-config";

export const DEFAULT_API_HOST = "https://api.nextchat.dev";
export const OPENAI_BASE_URL = "https://api.openai.com";

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
}

export enum ModelProvider {
  GPT = "GPT",
  DBC = "DBC",
}

export const OpenaiPath = {
  ChatPath: "v1/chat/completions",
  UsagePath: "dashboard/billing/usage",
  SubsPath: "dashboard/billing/subscription",
  ListModelPath: "v1/models",
};

export const Azure = {
  ExampleEndpoint: "https://{resource-url}/openai/deployments/{deploy-id}",
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

export const KnowledgeCutOffDate: Record<string, string> = {
  default: "2021-09",
  "gpt-4-turbo": "2023-12",
  "gpt-4-turbo-2024-04-09": "2023-12",
  "gpt-4-turbo-preview": "2023-12",
  "gpt-4o": "2023-10",
  "gpt-4o-2024-05-13": "2023-10",
  "gpt-4-vision-preview": "2023-04",
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

// Each key is a stable alias for the DBC LLM endpoint.
// Set hiddenFromUi: true for aliases used internally but not shown in chat options.
export const DBC_LLM_ENDPOINT_MODEL_CONFIG = {
  chatbib: {
    label: "chatbib",
    model: "google/gemma-3-12b-it",
  },
  "gemma3-12b": {
    label: "Gemma 3 12B",
    model: "google/gemma-3-12b-it",
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
