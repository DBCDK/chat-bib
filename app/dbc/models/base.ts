import { CustomModel, GenerateRequest } from "../index";
import { llmGenerate } from "../llmClient";

async function generate({ messages, parameters, say, close }: GenerateRequest) {
  // We just pass it through to the LLM backend
  await llmGenerate({
    messages,
    parameters,
    say, // Remove this, if you don't want it to stream directly to client
  });
  close();
}

export default {
  generate,
} as CustomModel;
