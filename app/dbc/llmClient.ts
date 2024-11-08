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
  const parameters = { temperature: 0.001, ...input.parameters };

  delete parameters.model;
  delete parameters.cutOff;
  const fetchUrl = serverConfig.generateStreamUrl;
  const requestBodyStr = JSON.stringify({
    inputs: llmFormat(input.messages),
    parameters,
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
        try {
          // console.log("decodedValue", decodedValue);
          const obj = JSON.parse(decodedValue);
          generatedText += obj?.token?.text;

          input.say?.(obj);
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
