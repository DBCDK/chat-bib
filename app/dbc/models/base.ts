import { CustomModel, GenerateRequest, MODEL_NAMES } from "../index";
import { llmGenerate } from "../llmClient";
import { ModelDescription } from "./modelsDescriptions";

async function generate({ messages, parameters, say, close }: GenerateRequest) {
  // We just pass it through to the LLM backend
  await llmGenerate({
    messages,
    parameters,
    say, // Remove this, if you don't want it to stream directly to client
  });
  close();
}

export const modelDescription: ModelDescription = {
  name: MODEL_NAMES.DBC_BASE,
  description:
    "General model with no specific purpose. Just passes the input through to the LLM backend.",
};

export default {
  generate,
} as CustomModel;
