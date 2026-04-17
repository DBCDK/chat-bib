import { MessageRole } from "../typing";
import { BuiltinMask } from "./typing";

const CHATBIB_SYSTEM =
  "Du hedder Chatbib, og er en dansk sprogmodel udviklet til at hjælpe bibliotekarer. Du bygger på Mixtral modellen. Du er en hjælpsom og venlig chatbot, der altid svarer på dansk. Du prøver altid at svare sandfærdigt og venligt.";

const SKOLEGPT_V3_SYSTEM =
  "Du er SkoleGPT, en dansk sprogmodel udviklet af Center for Undervisningsmidler (CFU). Du bygger på sprogmodellen gemma3-12b. Du er en hjælpsom og venlig chatbot, der udelukkende forstår og skriver dansk. Du vil altid svare på dansk og ingen andre sprog. Kan du ikke give brugeren svar på dansk, skal du i stedet bede om en omformulering.";

const SKOLEGPT_MIXTRAL_SYSTEM =
  "Du er SkoleGPT, en dansk sprogmodel udviklet af Center for Undervisningsmidler (CFU). Du bygger på sprogmodellen Mixtral. Du er en hjælpsom og venlig chatbot, der udelukkende forstår og skriver dansk. Du vil altid svare på dansk og ingen andre sprog. Kan du ikke give brugeren svar på dansk, skal du i stedet bede om en omformulering.";

export const CHATDBC_MASKS: BuiltinMask[] = [
  {
    avatar: "gpt-bot",
    name: "Gemma 3-12B",
    context: [
      {
        id: "chatdbc-gemma3-12b",
        role: MessageRole.System,
        content:
          "Du er ChatDBC, lokal DBC-udgave af skolegpt/chatbib-koden, der kører gemma3-12b.",
        date: "",
      },
    ],
    modelConfig: {
      model: "gemma3-12b",
      temperature: 0.7,
      top_p: 0.95,
      max_tokens: 2000,
      presence_penalty: 0,
      frequency_penalty: 0,
      sendMemory: true,
      historyMessageCount: 32,
      compressMessageLengthThreshold: 1000,
    },
    lang: "da",
    builtin: true,
    createdAt: 0,
    hideContext: true,
  },
  {
    avatar: "1f47e",
    name: "ChatBib (Mixtral)",
    context: [
      {
        id: "chatdbc-chatbib",
        role: MessageRole.System,
        content: CHATBIB_SYSTEM,
        date: "",
      },
    ],
    modelConfig: {
      model: "chatbib",
      temperature: 0.3,
      top_p: 1,
      max_tokens: 2000,
      presence_penalty: 0,
      frequency_penalty: 0,
      sendMemory: true,
      historyMessageCount: 4,
      compressMessageLengthThreshold: 1000,
    },
    lang: "da",
    builtin: true,
    createdAt: 0,
    hideContext: true,
  },
  {
    avatar: "gpt-bot",
    name: "Hawkeye (Mixtral)",
    context: [
      {
        id: "chatdbc-hawkeye",
        role: MessageRole.System,
        content:
          "Du er ChatDBC med modellen Hawkeye (Mixtral). Du er en hjælpsom og venlig chatbot, der primært svarer på dansk, medmindre brugeren tydeligt beder om et andet sprog.",
        date: "",
      },
    ],
    modelConfig: {
      model: "hawkeye",
      temperature: 0.7,
      top_p: 0.95,
      max_tokens: 2000,
      presence_penalty: 0,
      frequency_penalty: 0,
      sendMemory: true,
      historyMessageCount: 32,
      compressMessageLengthThreshold: 1000,
    },
    lang: "da",
    builtin: true,
    createdAt: 0,
    hideContext: true,
  },
  {
    avatar: "1f392",
    name: "MitCFU-RAG",
    context: [],
    modelConfig: {
      model: "mitcfu-rag",
      temperature: 0.7,
      top_p: 0.95,
      max_tokens: 2000,
      presence_penalty: 0,
      frequency_penalty: 0,
      sendMemory: true,
      historyMessageCount: 16,
      compressMessageLengthThreshold: 1000,
    },
    lang: "da",
    builtin: true,
    createdAt: 0,
    hideContext: true,
  },
  {
    avatar: "1f9d1-200d-1f52c",
    name: "Science-RAG (CFU)",
    context: [
      {
        id: "chatdbc-science-rag",
        role: MessageRole.System,
        content: "",
        date: "",
      },
    ],
    syncGlobalConfig: false,
    modelConfig: {
      model: "science-rag",
      temperature: 0.5,
      top_p: 1,
      max_tokens: 4000,
      presence_penalty: 0,
      frequency_penalty: 0,
      sendMemory: true,
      historyMessageCount: 64,
    },
    lang: "da",
    builtin: true,
    createdAt: 0,
    plugin: [],
    hideContext: true,
  },
  {
    avatar: "gpt-bot",
    name: "SkoleGPT(Mixtral)",
    context: [
      {
        id: "chatdbc-skolegpt-mixtral",
        role: MessageRole.System,
        content: SKOLEGPT_MIXTRAL_SYSTEM,
        date: "",
      },
    ],
    modelConfig: {
      model: "skolegpt-mixtral",
      temperature: 0.7,
      top_p: 0.95,
      max_tokens: 2000,
      presence_penalty: 0,
      frequency_penalty: 0,
      sendMemory: true,
      historyMessageCount: 16,
      compressMessageLengthThreshold: 1000,
    },
    lang: "da",
    builtin: true,
    createdAt: 0,
    hideContext: true,
  },
  {
    avatar: "gpt-bot",
    name: "SkoleGPT (Gemma 3 12B)",
    context: [
      {
        id: "chatdbc-skolegpt-v3",
        role: MessageRole.System,
        content: SKOLEGPT_V3_SYSTEM,
        date: "",
      },
    ],
    modelConfig: {
      model: "skolegpt-v3",
      temperature: 0.7,
      top_p: 0.95,
      max_tokens: 2000,
      presence_penalty: 0,
      frequency_penalty: 0,
      sendMemory: true,
      historyMessageCount: 16,
      compressMessageLengthThreshold: 1000,
    },
    lang: "da",
    builtin: true,
    createdAt: 0,
    hideContext: true,
  },
];
