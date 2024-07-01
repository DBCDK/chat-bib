export type GenerateRequest = {
  messages: Message[];
  parameters: LLMParameters;
  say: Function;
  close: Function;
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
};

export type LLMRequest = {
  messages: Message[];
  parameters: LLMParameters;
  say?: Function;
};

export enum MODEL_NAMES {
  DBC_BASE = "dbc-base",
  DBC_POEM = "dbc-poem",
  DBC_HELLO_WORLD = "dbc-hello-world",
}

export const modelNames = Object.values(MODEL_NAMES);
