import { CustomModel, GenerateRequest, MODEL_NAMES } from "../index";
import { llmGenerate } from "../llmClient";
import { ModelDescription } from "./modelsDescriptions";
import { generate as toolGenerate, tgiGroqToolClient } from "../tools";

import readyTool from "../tools/ready";
import webSearchTool from "../tools/webSearch";
import findSeriesTool from "../tools/findSeries";
import materialSearchTool from "../tools/materialSearchComplex";
import similarWorksTool from "../tools/similarWorks";

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

  await toolGenerate({
    tools: [
      webSearchTool,
      materialSearchTool,
      findSeriesTool,
      similarWorksTool,
    ],
    request: { messages, parameters, say, close },
    defaultTool: readyTool,
    toolClient: tgiGroqToolClient,
  });

  close();
}

export const modelDescription: ModelDescription = {
  name: MODEL_NAMES.DBC_TOOLS,
  description:
    "Denne model benytter forskellige tools til at fremsøge information",
};

export default {
  generate,
} as CustomModel;
