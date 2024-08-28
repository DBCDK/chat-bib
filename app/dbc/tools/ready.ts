import { ToolDef } from ".";
import { GenerateRequest } from "..";
import PluginStatus from "../components/PluginStatus/PluginStatus";
import { llmGenerate } from "../llmClient";

export default {
  dependencies: [],
  schema: {
    type: "function",
    function: {
      name: "ready_to_answer",
      description: "Do we have all information to answer the user?",
      parameters: {
        type: "object",
        properties: {
          keywords: {
            type: "string",
            description:
              "A few keywords that can be used as a help to generate the final response",
          },
          explainCapabilities: {
            type: "boolean",
            description:
              "Set this to true, if we need to explain to the user, what our capabilities are",
          },
          presentLibraryRelated: {
            type: "boolean",
            description:
              "Set this to true, if we need to present library related content, such as materials, authors etc.",
          },
          missingContext: {
            type: "string",
            description:
              "If we are missing some context, give a short description of what is missing",
          },
        },
        required: [
          "keywords",
          "explainCapabilities",
          "presentLibraryRelated",
          "missingContext",
        ],
      },
    },
  },
  func: async (
    {
      keywords,
      presentLibraryRelated,
      missingContext,
      explainCapabilities,
    }: {
      keywords?: string;
      presentLibraryRelated?: boolean;
      missingContext?: string;
      explainCapabilities?: boolean;
    } = {},
    input: GenerateRequest,
    tools: ToolDef[],
  ) => {
    PluginStatus.serialize({
      say: input.say,
      pluginName: "ready_to_answer",
      description: `Klar til at svare ${explainCapabilities}, ${presentLibraryRelated}, ${missingContext}`,
    });

    let messages = input.messages;

    let prompt = `Du er den hjælpsomme biblioteksassistent ChatBib, der altid svarer sandfærdigt og på dansk.

Du kan hjælpe med at:
 - Søge på internettet
 - Finde biblioteksmaterialer
 - Komme med anbefalinger til din næste bog`;

    prompt += `
Hvis du præsenterer et biblioteksmateriale som en bog eller film, så hav fokus på, hvorfor den vil være interessant for brugeren. Stil gerne et spørgsmål, der kan hjælpe med at afgrænse anbefaling yderligere.
 
 `;

    if (explainCapabilities) {
      messages = input?.messages?.filter((m) => m.role !== "tool");
    }

    await llmGenerate({
      messages: [
        ...messages,
        {
          role: "system",
          content: prompt,
        },
      ],
      parameters: { temperature: 0.4, max_new_tokens: 500 },
      say: input.say, // Remove this, if you don't want it to stream directly to client
    });
  },
} as ToolDef;
