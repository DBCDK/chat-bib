import { CustomModel, GenerateRequest, Message } from "../index";
import { llmGenerate } from "../llmClient";
import { createLLMWithPlugins, PLUGINS } from "../plugins";

async function generate({
  messages,
  parameters,
  say,
  close,
  conversationId,
}: GenerateRequest) {
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
  const llm = createLLMWithPlugins({
    rootPlugins: [PLUGINS.fetch_library],
    final: PLUGINS.ready_to_answer,
  });

  await llm.generate({ messages, say, close, conversationId, parameters });
}

export default {
  generate,
} as CustomModel;
