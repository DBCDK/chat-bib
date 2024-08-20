import { CustomModel, GenerateRequest, MODEL_NAMES } from "../index";
import { llmGenerate } from "../llmClient";
import { llmGenerate as faktaChatClient } from "../faktaChatClient";
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

  await faktaChatClient({
    messages,
    parameters,
    say, // Remove this, if you don't want it to stream directly to client
  });
  close();
}

export const modelDescription: ModelDescription = {
  name: MODEL_NAMES.DBC_FAKTA_CHAT,
  description: "Denne model benytter Faktalink chat",
};

export default {
  generate,
} as CustomModel;
