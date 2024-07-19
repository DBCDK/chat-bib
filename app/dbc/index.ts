export type GenerateRequest = {
  messages: Message[];
  parameters: LLMParameters;
  say: Function;
  close: Function;
  conversationId: string;
};
export type CustomModel = {
  generate: (input: GenerateRequest) => void;
};

export type Message = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type LLMParameters = {
  model?: MODEL_NAMES;
  temperature?: number;
  top_p?: number;
  presence_penalty?: number;
  frequency_penalty?: number;
  max_new_tokens?: number;
  stream?: boolean;
  cutOff?: number;
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
  DBC_WEB_SEARCH = "dbc-web-search",
  DBC_WEB_SEARCH_2 = "dbc-web-search-2",
  DBC_SIMPLE_SEARCH = "dbc-simple-search",
  DBC_VISUALS_EXAMPLES = "dbc-visuals-example",
  DBC_VECTOR_LIBRARIAN = "dbc-vector-librarian",
  DBC_PLUGINS = "dbc-plugins",
  // DBC_POEM = "dbc-poem",
  // DBC_HELLO_WORLD = "dbc-hello-world",
  // DBC_WITH_FETCH = "dbc-with-fetch",
}

const defaultModel = MODEL_NAMES.DBC_WEB_SEARCH_2;

export const modelNames: string[] = [
  defaultModel,
  ...Object.values(MODEL_NAMES)
    .filter((name) => name !== defaultModel)
    .sort((a, b) => a.localeCompare(b)),
];
