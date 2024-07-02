import { log } from "dbc-node-logger";

import { getServerSideConfig } from "@/app/config/server";
import { LLMRequest, Message } from ".";

const serverConfig = getServerSideConfig();

const llmFormat = (msgs: Message[]): string => {
  let result = "<s>[INST] <<SYS>>\n";
  if (msgs[0]?.role === "system") {
    result += msgs.shift()?.content || "";
  }
  result += "\n<</SYS>>\n\n";

  msgs.forEach((msg) => {
    result += msg.content;
    result += msg.role === "assistant" ? "</s><s>[INST]" : "[/INST]";
  });

  return result;
};

export async function llmGenerate(input: LLMRequest) {
  const decoder = new TextDecoder("utf-8");

  const fetchOptions: RequestInit = {
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
    method: "POST",
    // to fix #2485: https://stackoverflow.com/questions/55920957/cloudflare-worker-typeerror-one-time-use-body
    redirect: "manual",
    // @ts-ignore
    duplex: "half",
  };
  const fetchUrl = serverConfig.generateStreamUrl;
  const requestBodyStr = JSON.stringify({
    inputs: llmFormat(input.messages),
    parameters: input.parameters,
  });
  const res = await fetch(fetchUrl, {
    ...fetchOptions,
    body: requestBodyStr,
    signal: input?.controller?.signal,
  });
  let generatedText = "";
  const reader = res.body?.getReader();
  async function processChunk() {
    const { value, done } = (await reader?.read()) || { done: true };
    if (done) {
      return;
    }

    const rawValues = decoder.decode(value, { stream: false }).split("\n");

    rawValues.forEach((rawValue) => {
      const decodedValue = rawValue.replace("data: ", "").trim();
      try {
        const obj = JSON.parse(decodedValue);
        generatedText = obj.generated_text;
        input.say?.(obj);
      } catch (e) {}
    });

    await processChunk();
  }
  await processChunk();

  log.info(
    JSON.stringify({
      "llm-request": requestBodyStr,
      "llm-respones": generatedText,
    }),
    {
      type: "data",
    },
  );

  return generatedText;
}
