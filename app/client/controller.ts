import type { ChatOptions } from "./api";

// To store message streaming controller
export const ChatControllerPool = {
  controllers: {} as Record<string, AbortController>,

  addController(
    sessionId: string,
    messageId: string,
    controller: AbortController,
  ) {
    const key = this.key(sessionId, messageId);
    this.controllers[key] = controller;
    return key;
  },

  stop(sessionId: string, messageId: string) {
    const key = this.key(sessionId, messageId);
    const controller = this.controllers[key];
    controller?.abort();
  },

  stopAll() {
    Object.values(this.controllers).forEach((v) => v.abort());
  },

  hasPending() {
    return Object.values(this.controllers).length > 0;
  },

  remove(sessionId: string, messageId: string) {
    const key = this.key(sessionId, messageId);
    delete this.controllers[key];
  },

  key(sessionId: string, messageIndex: string) {
    return `${sessionId},${messageIndex}`;
  },
};

/**
 * Watches one chat request. Both platform clients use it. An answer then ends
 * exactly once and in the same way in each of them.
 *
 * progress() restarts the deadline. Call it when the request starts and each
 * time the answer grows. The server gets timeoutMs to answer. After that a
 * silence may last three times as long. A busy model can be slow to write its
 * first word. A request that stays silent longer is aborted. So a long answer
 * is never cut off but a dead connection still ends.
 *
 * finish() reports the end. With a failure the text that arrived stays on
 * screen and the turn is marked as failed. Without a failure the text is the
 * answer. That also holds when the pupil pressed stop.
 */
export function watchRequest(
  options: ChatOptions,
  controller: AbortController,
  timeoutMs: number,
) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let timedOut = false;
  let limit = timeoutMs;
  const watch = {
    finished: false,
    progress() {
      clearTimeout(timer);
      timer = setTimeout(() => {
        timedOut = true;
        controller.abort();
      }, limit);
      limit = 3 * timeoutMs;
    },
    finish(text: string, failure?: string) {
      if (watch.finished) return;
      watch.finished = true;
      clearTimeout(timer);
      // A stop or a timeout aborts the request. The abort then decides the
      // outcome. An error that it caused on the way does not count.
      if (controller.signal.aborted) {
        failure = timedOut ? "timeout" : text ? undefined : "aborted";
      }
      if (failure) {
        if (text) options.onUpdate?.(text, "");
        options.onError?.(new Error(failure));
      } else if (text) {
        options.onFinish(text);
      } else {
        options.onError?.(new Error("empty response from server"));
      }
      // Nothing more will be read. Let go of the connection.
      controller.abort();
    },
  };
  return watch;
}
