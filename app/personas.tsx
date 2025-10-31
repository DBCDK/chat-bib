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
      "Chatbot, der kan hjælpe med at besvare generelle spørgsmål baseret på generativ AI og den viden der er indbygget i sprogmodellen.",
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
    description:
      "Chatbot der kan hjælpe med at besvare spørgsmål og vise eksempler fra bibliotek.dk.",
    image: "avatar1.svg",
    mask: {
      id: "100028",
      createdAt: 1688899480410,
      avatar: "1f47e",
      name: "Bibliotek.dk",
      context: [
        {
          id: "Copilot-0",
          role: MessageRole.System,
          content: `${defaultSystemPrompt}`,
          date: "",
        },
        {
          id: "Copilot-1",
          role: MessageRole.Assistant,
          content:
            "Hej! Hvordan kan jeg hjælpe dig i dag? \n Jeg er god til at finde information fra bibliotek.dk.",
          date: "",
        },
      ],
      modelConfig: {
        model: MODEL_NAMES.DBC_WEB_SEARCH_2,
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
    description:
      "Chatbot der kan hjælpe med at finde information fra Faktalink.",
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
          content: `${defaultSystemPrompt}`,
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
    description:
      "Chatbot der anvender en søgemaskine der returnerer links til relevante sider på Nettet uden reklamer og indblanding af økonomiske interesser. Den anvender Brave Search API.",
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
  image?: string;
  mask: Mask;
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

// Personas that should only appear in MultiChat (not in the New Chat screen)
export const MULTICHAT_PERSONAS_EXTRA = [
  {
    name: "SimpleSearch",
    description:
      "Chatbot, der omsætter brugerens input til søgninger i FBI-Databrønd. Prototypen anvender FBI´s nye søgeplatform, FBI-API, Simple Search og Complex Search og inkluderer prototypen på et nyt visningsmodul, der blander billeder og tekst i en chatgrænseflade.",
    image: "avatar1.svg",
    mask: {
      id: "100033",
      createdAt: 1688899480410,
      avatar: "1f47e",
      name: "SimpleSearch",
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
      modelConfig: {
        model: MODEL_NAMES.DBC_SIMPLE_SEARCH,
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
    name: "ComplexSearch",
    description:
      "Chatbot, der udfører avancerede søgninger i FBI-Databrønd med Complex Search.",
    image: "avatar2.svg",
    mask: {
      id: "100034",
      createdAt: 1688899480410,
      avatar: "1f47e",
      name: "ComplexSearch",
      context: [
        {
          id: "Copilot-0",
          role: MessageRole.System,
          content: `${defaultSystemPrompt} Brug kun Complex Search til at løse søgeopgaver.`,
          date: "",
        },
        {
          id: "Copilot-1",
          role: MessageRole.Assistant,
          content: "Hej! Hvordan kan jeg hjælpe med en mere avanceret søgning?",
          date: "",
        },
      ],
      modelConfig: {
        model: MODEL_NAMES.DBC_COMPLEX_SEARCH,
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
