import { MODEL_NAMES } from "./dbc";
import { Lang } from "./locales";
import { DEFAULT_CONFIG } from "./store";
import { Mask } from "./store/mask";
import { MessageRole } from "./typing";

const defaultSystemPrompt =
  "Du hedder Chatbib, og er en dansk sprogmodel udviklet til at hjælpe bibliotekarer. Du bygger på Mixtral modellen. Du er en hjælpsom og venlig chatbot, der alitd svarer på dansk. Du prøver alitd at svare sandfærdigt og venligt.";
export const PERSONAS = [
  {
    name: "Chatbib",
    description:
      "En chatbot, der kan hjælpe med at besvare generelle spørgsmål.",
    image: "avatar4.svg",
    mask: {
      id: "100031",
      createdAt: 1688899480410,
      avatar: "1f47e",
      name: "Chatbib",
      context: [
        {
          id: "Copilot-0",
          role: MessageRole.System,
          content: defaultSystemPrompt,
          date: "",
        },
        {
          id: "Copilot-1",
          role: MessageRole.Assistant,
          content: "Hej! Hvordan kan jeg hjælpe dig i dag?",
          date: "",
        },
      ],
      modelConfig: {
        model: MODEL_NAMES.DBC_BASE,
        temperature: 0.3,
        top_p: 1,
        max_tokens: 2000,
        presence_penalty: 0,
        frequency_penalty: 0,
        sendMemory: true,
        historyMessageCount: 4,
        compressMessageLengthThreshold: 1000,
        enableInjectSystemPrompts: true,
        template: "{{input}}",
      },
      lang: "da" as Lang,
      builtin: true,
    },
  },
  {
    name: "Bibliotek.dk",
    description: "Få hjælp til at finde materialer på Bibliotek.dk.",
    image: "avatar1.svg",
    mask: {
      id: "100028",
      createdAt: 1688899480410,
      avatar: "1f47e",
      name: "Bibliotekaren Birgitte",
      context: [
        {
          id: "Copilot-0",
          role: MessageRole.System,
          content: `${defaultSystemPrompt} Du kan hjælpe med at anbefale bøger og søge efter værker på bibliotek.dk.`,
          date: "",
        },
        {
          id: "Copilot-1",
          role: MessageRole.Assistant,
          content:
            "Hej! Hvordan kan jeg hjælpe dig i dag? Jeg kan give anbefalinger og søge efter værker på bibliotek.dk.",
          date: "",
        },
      ],
      availableModels: [
        MODEL_NAMES.DBC_MULTI_SEARCH,
        MODEL_NAMES.DBC_MULTI_SEARCH_NO_CONTEXT,
      ],
      modelConfig: {
        model: MODEL_NAMES.DBC_MULTI_SEARCH_NO_CONTEXT,
        temperature: 0.3,
        top_p: 1,
        max_tokens: 2000,
        presence_penalty: 0,
        frequency_penalty: 0,
        sendMemory: true,
        historyMessageCount: 4,
        compressMessageLengthThreshold: 1000,
        enableInjectSystemPrompts: true,
        template: "{{input}}",
      },
      lang: "da" as Lang,
      builtin: true,
    },
  },
  {
    name: "Faktalink",
    description: "Find information fra Faktalink.",
    image: "avatar3.svg",
    mask: {
      id: "100030",
      createdAt: 1688899480410,
      avatar: "1f47e",
      name: "Faktalink",
      context: [
        {
          id: "Copilot-0",
          role: MessageRole.System,
          content: `${defaultSystemPrompt} Du kan hjælpe brugere med at finde information fra Faktalink.`,
          date: "",
        },
        {
          id: "Copilot-1",
          role: MessageRole.Assistant,
          content:
            "Hej! Hvordan kan jeg hjælpe dig i dag? \n Jeg er god til at finde information fra Faktalink.",
          date: "",
        },
      ],
      modelConfig: {
        model: MODEL_NAMES.DBC_FAKTA_CHAT,
        temperature: 0.3,
        top_p: 1,
        max_tokens: 2000,
        presence_penalty: 0,
        frequency_penalty: 0,
        sendMemory: true,
        historyMessageCount: 4,
        compressMessageLengthThreshold: 1000,
        enableInjectSystemPrompts: true,
        template: "{{input}}",
      },
      lang: "da" as Lang,
      builtin: true,
    },
  },
  {
    name: "Websøgning",
    description: "Find information på internettet.",
    image: "avatar2.svg",
    mask: {
      id: "100029",
      createdAt: 1688899480410,
      avatar: "1f47e",
      name: "Websøgning",
      context: [
        {
          id: "Copilot-0",
          role: MessageRole.System,
          content: `${defaultSystemPrompt} Du kan hjælpe brugere med at finde information på internettet.`,
          date: "",
        },
        {
          id: "Copilot-1",
          role: MessageRole.Assistant,
          content:
            "Hej! Hvordan kan jeg hjælpe dig i dag?\n Jeg er god til at finde information på internettet.",
          date: "",
        },
      ],
      modelConfig: {
        model: MODEL_NAMES.DBC_WEB_SEARCH,
        temperature: 0.3,
        top_p: 1,
        max_tokens: 2000,
        presence_penalty: 0,
        frequency_penalty: 0,
        sendMemory: true,
        historyMessageCount: 4,
        compressMessageLengthThreshold: 1000,
        enableInjectSystemPrompts: true,
        template: "{{input}}",
      },
      lang: "da" as Lang,
      builtin: true,
    },
  },
];

export interface Persona {
  name: string;
  description: string;
  mask: Mask;
  image?: string;
}

export const DEFAULT_SYSTEM_PERSONA = {
  name: "",
  description: "",
  image: "",
  mask: {
    id: "100032",
    createdAt: 1688899480410,
    avatar: "1f47e",
    name: "Chatbib",
    context: [
      {
        id: "Copilot-0",
        role: MessageRole.System,
        content:
          "Du hedder Chatbib, og er en dansk sprogmodel udviklet til at hjælpe bibliotekarer. Du bygger på Mixtral modellen. Du er en hjælpsom og venlig chatbot, der alitd svarer på dansk. Du prøver alitd at svare sandfærdigt og venligt.",
        date: "",
      },
      {
        id: "Copilot-1",
        role: MessageRole.Assistant,
        content: "Hej! Hvordan kan jeg hjælpe dig i dag?",
        date: "",
      },
    ],
    modelConfig: {
      model: MODEL_NAMES.DBC_BASE,
      temperature: 0.3,
      top_p: 1,
      max_tokens: 2000,
      presence_penalty: 0,
      frequency_penalty: 0,
      sendMemory: true,
      historyMessageCount: 4,
      compressMessageLengthThreshold: 1000,
      enableInjectSystemPrompts: true,
      template: "{{input}}",
    },
    lang: "da" as Lang,
    builtin: true,
  },
};
