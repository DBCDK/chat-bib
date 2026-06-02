import { CustomModel, GenerateRequest, MODEL_NAMES } from "../index";
import { llmGenerate } from "../llmClient";
import { ModelDescription } from "./modelsDescriptions";

async function generate({ messages, parameters, say, close }: GenerateRequest) {
  if (messages?.[messages?.length - 1]?.role !== "user") {
    // We just pass it through to the LLM backend
    await llmGenerate({
      messages,
      parameters,
      say, // Remove this, if you don't want it to stream directly to client
    });
    close();

    return;
  }

  await llmGenerate({
    messages,
    parameters: {
      ...parameters,
      llmModel: "fakta-chat",
    },
    say, // Remove this, if you don't want it to stream directly to client
  });
  close();
}

export const modelDescription: ModelDescription = {
  name: MODEL_NAMES.DBC_FAKTA_CHAT,
  description:
    "En model der bruger indhold fra Faktalink til at give elever letforståelige forklaringer, baggrundsviden og kilder til skoleopgaver. Bruges til emner som samfund, kultur, historie og aktuelle temaer, hvor der ønskes dybde, overblik og troværdige ressourcer.",
};

export default {
  generate,
} as CustomModel;
