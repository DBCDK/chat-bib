import { log } from "dbc-node-logger";

import { getServerSideConfig } from "@/app/config/server";
import { LLMRequest } from ".";
import {
  DBC_LLM_ENDPOINT_MODEL_CONFIG,
  DBC_LLM_ENDPOINT_MODELS,
  DbcLlmEndpointModel,
} from "@/app/constant";

const serverConfig = getServerSideConfig();

export async function llmGenerate(input: LLMRequest) {
  const decoder = new TextDecoder("utf-8");

  const fetchUrl = `${serverConfig.dbcLlmEndpoint}/v1/chat/completions`;

  if (!fetchUrl) {
    throw new Error("DBC_LLM_ENDPOINT is not configured");
  }

  const fetchOptions: RequestInit = {
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${serverConfig.dbcLlmToken}`,
      "Cache-Control": "no-store",
    },
    method: "POST",
    redirect: "manual",
    // @ts-ignore
    duplex: "half",
  };

  const parameters = { ...input.parameters };

  // MODEL_NAMES are frontend "agents", not actual LLM model names.
  // llmModel is a stable UI alias; map it to the provider model sent to the endpoint.
  const requestedEndpointModel = (parameters as any)?.llmModel as
    | string
    | undefined;
    // if requestedEndpointModel is not in DBC_LLM_ENDPOINT_MODELS, use chatbib
  const modelAlias = DBC_LLM_ENDPOINT_MODELS.includes(
    requestedEndpointModel as DbcLlmEndpointModel,
  )
    ? requestedEndpointModel!
    : "chatbib";
    // get the model name from DBC_LLM_ENDPOINT_MODEL_CONFIG
  const modelName =
    DBC_LLM_ENDPOINT_MODEL_CONFIG[modelAlias as DbcLlmEndpointModel].model;

  const temperature = parameters.temperature ?? 0.001;
  const topP = parameters.top_p ?? 1;
  const maxTokens = parameters.max_new_tokens || 500;

  const requestBodyStr = JSON.stringify({
    messages: input.messages,
    model: modelName,
    temperature: temperature,
    top_p: topP,
    max_tokens: maxTokens,
    presence_penalty: parameters.presence_penalty || 0,
    frequency_penalty: parameters.frequency_penalty || 0,
    stream: true,
  });

  let generatedText = "";
  const now = performance.now();
  let firstToken: number = -1;
  const controller = input?.controller || new AbortController();

  try {
    const res = await fetch(fetchUrl, {
      ...fetchOptions,
      body: requestBodyStr,
      signal: controller?.signal,
    });

    const reader = res.body?.getReader();
    async function processChunk() {
      const { value, done } = (await reader?.read()) || { done: true };
      if (firstToken < 0) {
        firstToken = performance.now();
      }
      if (done) {
        return;
      }

      const rawValues = decoder.decode(value, { stream: false }).split("\n");

      rawValues.forEach((rawValue) => {
        const decodedValue = rawValue.replace(/data:\s*/, "").trim();
        if (!decodedValue || decodedValue === "[DONE]") {
          return;
        }
        try {
          const obj = JSON.parse(decodedValue);

          // OpenAI-compatible streaming format
          const delta = obj?.choices?.[0]?.delta?.content;
          if (delta) {
            generatedText += delta;
            input.say?.({ token: { text: delta } });
          }

          // Handle stop or finish reason
          if (obj?.choices?.[0]?.finish_reason) {
            return;
          }

          if (
            input?.parameters?.cutOff &&
            generatedText?.length > input?.parameters?.cutOff
          ) {
            // controller?.abort();
          }
        } catch (e: any) {}
      });

      await processChunk();
    }
    await processChunk();
  } catch (e: any) {
    console.log("GOT ERROR", e);
    if (e.name !== "AbortError") {
      generatedText += "--ABORTED--";
    }
  }

  log.info(
    JSON.stringify({
      "llm-request": requestBodyStr,
      "llm-response": generatedText,
      timeToFirstToken: firstToken > 0 ? firstToken - now : 0,
    }),
    {
      type: "data",
    },
  );

  return generatedText;
}
