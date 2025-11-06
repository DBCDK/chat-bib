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
    multiAgentEligible: true,
    showInNewChat: true,
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
      "Chatbot, der omsætter brugerens input til søgninger i FBI-Databrønd. Prototypen anvender FBI´s nye søgeplatform, FBI-API, Simple Search og Complex Search og inkluderer prototypen på et nyt visningsmodul, der blander billeder og tekst i en chatgrænseflade.",
    multiAgentEligible: true,
    showInNewChat: true,
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
    name: "FaktaChat",
    description:
      "Chatbot der anvender en såkaldt RAG-model, hvor svarene baserer sig på fakta, som bibliotekerne kan stå inde for. Prototypen anvender foreløbig udelukkende artikler fra Faktalink, men kan henad vejen udbygges til at inkludere andre troværdige bibliotekskilder.",
    multiAgentEligible: false,
    showInNewChat: true,
    image: "avatar3.svg",
    mask: {
      id: "100030",
      createdAt: 1688899480410,
      avatar: "1f47e",
      name: "FaktaChat",
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
    description: (
      <div>
        Chatbot der anvender en søgemaskine der returnerer links til relevante
        sider på Nettet uden reklamer og indblanding af økonomiske interesser.
        Den anvender{" "}
        <a
          href="https://brave.com/search/api/"
          target="_blank"
          onClick={(e) => {
            e.stopPropagation();
          }}
        >
          Brave Search API
        </a>
        .
      </div>
    ),
    multiAgentEligible: true,
    showInNewChat: true,
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
  {
    name: "SimpleSearch",
    description:
      "Chatbot, der omsætter brugerens input til søgninger i FBI-Databrønd. Prototypen anvender FBI´s nye søgeplatform, FBI-API, Simple Search og Complex Search.",
    multiAgentEligible: false,
    showInNewChat: false,
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
      availableModels: [MODEL_NAMES.DBC_SIMPLE_SEARCH],
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
      "Chatbot der udfører avancerede søgninger i FBI-Databrønd via Complex Search.",
    multiAgentEligible: false,
    showInNewChat: false,
    image: "avatar1.svg",
    mask: {
      id: "100034",
      createdAt: 1688899480410,
      avatar: "1f47e",
      name: "ComplexSearch",
      context: [
        {
          id: "Copilot-0",
          role: MessageRole.System,
          content: `${defaultSystemPrompt} Du kan formulere og udføre avancerede søgeforespørgsler i bibliotekssystemet.`,
          date: "",
        },
        {
          id: "Copilot-1",
          role: MessageRole.Assistant,
          content:
            "Hej! Hvordan kan jeg hjælpe dig i dag? Jeg kan lave avancerede søgninger i bibliotek.dk.",
          date: "",
        },
      ],
      availableModels: [MODEL_NAMES.DBC_COMPLEX_SEARCH],
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

export interface Persona {
  name: string;
  description: string;
  mask: Mask;
  image?: string;
  multiAgentEligible?: boolean;
  showInNewChat?: boolean;
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
