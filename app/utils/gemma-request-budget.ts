import type { RequestMessage } from "../client/api";
import { imageCost, textTokens } from "./message-content";

export const GEMMA_CONTEXT_TOKENS = 32768;
// Room kept free for the answer and its thinking. The answer can be longer
// than this when the request is small.
const GEMMA_REPLY_RESERVE = 4096;
const GEMMA_GATEWAY_RESERVE = 256;
export const GEMMA_INPUT_TOKEN_BUDGET =
  GEMMA_CONTEXT_TOKENS - GEMMA_REPLY_RESERVE - GEMMA_GATEWAY_RESERVE;
export const GEMMA_REQUEST_TOO_LONG =
  "Beskeden, materialerne og chathistorikken fylder for meget tilsammen. " +
  "Forkort beskeden, vælg færre materialer, eller start en ny chat.";

// Rough token count for a whole request. Text is estimated and each picture is
// added at its own cost. The estimate runs a little high on real text so the
// check stops before the model reaches its real limit.
function requestTokens(messages: RequestMessage[]): number {
  let tokens = 0;
  for (const message of messages) {
    if (typeof message.content === "string") {
      tokens += textTokens(message.content);
      continue;
    }
    for (const part of message.content) {
      if (part.type === "image_url") tokens += imageCost(part.image_url?.tokens);
      else tokens += textTokens(part.text ?? "");
    }
  }
  return tokens;
}

// Stops a request that would not fit the model context. The clients call this
// with the final messages after file text is folded in and system prompts are
// merged.
export function assertGemmaRequestFits(messages: RequestMessage[]): void {
  if (requestTokens(messages) > GEMMA_INPUT_TOKEN_BUDGET)
    throw new Error(GEMMA_REQUEST_TOO_LONG);
}
