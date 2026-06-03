import type { DbcLlmEndpointModel } from "@/app/constant";

export type GenerateRequest = {
  messages: Message[];
  parameters: LLMParameters;
  say: Function;
  close: Function;
  conversationId?: string;
  useContextForSearch?: Boolean;
};
export type CustomModel = {
  generate: (input: GenerateRequest) => void;
};

export type Message = {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
};

export type LLMParameters = {
  model?: MODEL_NAMES;
  // Endpoint model to use for the DBC LLM endpoint. This is different from
  // the high-level agent model above, and maps to DBC_LLM_ENDPOINT_MODEL_CONFIG.
  llmModel?: DbcLlmEndpointModel;
  temperature?: number;
  top_p?: number;
  presence_penalty?: number;
  repetition_penalty?: number;
  frequency_penalty?: number;
  max_new_tokens?: number;
  stream?: boolean;
  cutOff?: number;
  // Whether to use the slow method in intent2terms endpoint. Only used in simpleSearch.
  use_slow_method?: boolean;
};

export type LLMRequest = {
  conversationId?: string;
  messages: Message[];
  parameters: LLMParameters;
  say?: Function;
  controller?: AbortController;
};

// Only allow dbc-base for now
export enum MODEL_NAMES {
  DBC_BASE = "dbc-base",
  DBC_TOOLS = "dbc-tools",
  DBC_WEB_SEARCH = "dbc-web-search",
  DBC_WEB_SEARCH_2 = "dbc-web-search-2",
  DBC_SIMPLE_SEARCH = "dbc-simple-search",
  DBC_COMPLEX_SEARCH = "dbc-complex-search",
  DBC_VISUALS_EXAMPLES = "dbc-visuals-example",
  DBC_VECTOR_LIBRARIAN = "dbc-vector-librarian",
  DBC_PLUGINS = "dbc-plugins",
  // DBC_POEM = "dbc-poem",
  // DBC_HELLO_WORLD = "dbc-hello-world",
  // DBC_WITH_FETCH = "dbc-with-fetch",
  DBC_GENERAL_MODEL = "dbc-general-model",
  DBC_VECTOR_DB = "dbc-vector-db",
  DBC_MULTI_SEARCH = "dbc-multi-search",
  DBC_MULTI_SEARCH_NO_CONTEXT = "dbc-multi-search-no-context",
  DBC_FAKTA_CHAT = "dbc-fakta-chat",
}

const defaultModel = MODEL_NAMES.DBC_WEB_SEARCH_2;

export const modelNames: string[] = [
  defaultModel,
  ...Object.values(MODEL_NAMES)
    .filter((name) => name !== defaultModel)
    .sort((a, b) => a.localeCompare(b)),
];
