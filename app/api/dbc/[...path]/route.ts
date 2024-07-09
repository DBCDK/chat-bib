import { NextRequest, NextResponse } from "next/server";
import { LLMRequest, MODEL_NAMES } from "@/app/dbc";

import base from "@/app/dbc/models/base";
import websearch from "@/app/dbc/models/websearch";
import simpleSearch from "@/app/dbc/models/simpleSearch";
import complexSearch from "@/app/dbc/models/complexSearch";

import visualsexamples from "@/app/dbc/models/visualsexamples";

const models = {
  [MODEL_NAMES.DBC_SIMPLE_SEARCH]: simpleSearch,
  [MODEL_NAMES.DBC_COMPLEX_SEARCH]: complexSearch,

  [MODEL_NAMES.DBC_BASE]: base,
  [MODEL_NAMES.DBC_WEB_SEARCH]: websearch,

  // [MODEL_NAMES.DBC_HELLO_WORLD]: helloworld,
  // [MODEL_NAMES.DBC_POEM]: poem,
  [MODEL_NAMES.DBC_VISUALS_EXAMPLES]: visualsexamples,
};

function createOutputStream() {
  let timeoutId: NodeJS.Timeout;
  let queue: (string | object)[] = [];
  const encoder = new TextEncoder();
  let controller: ReadableStreamDefaultController | null;
  const stream = new ReadableStream({
    start(c) {
      controller = c;
    },
  });

  function checkQueue() {
    timeoutId = setTimeout(async () => {
      if (queue.length > 0 && controller) {
        const obj = queue.shift();
        if (typeof obj === "object") {
          const encoded = encoder.encode(JSON.stringify(obj) + "\n");
          await controller?.enqueue(encoded);
        } else {
          const encoded = encoder.encode(
            JSON.stringify({ token: { special: false, text: obj } }) + "\n",
          );
          await controller?.enqueue(encoded);
        }
      }
      checkQueue();
    }, 15);
  }
  checkQueue();

  async function say(obj: string | object) {
    if (typeof obj === "object") {
      queue = [...queue, obj];
    } else {
      const splitted = obj.split(/(\s)/g);
      queue = [...queue, ...splitted];
    }
  }

  function close() {
    setTimeout(async () => {
      if (queue.length === 0) {
        clearTimeout(timeoutId);
        await controller?.close();
        controller = null;
      } else {
        close();
      }
    }, 100);
  }

  return { stream, say, close };
}

/**
 * This is a route handler for accessing models running on DBC's infrastructure
 * using the generate_stream endpoint
 *
 * TODO implement some kind of auth mechanism
 *
 */
async function handle(
  req: NextRequest,
  { params }: { params: { path: string[] } },
) {
  if (req.method === "OPTIONS") {
    return NextResponse.json({ body: "OK" }, { status: 200 });
  }

  const clonedRequestBody = await req.text();
  const requestBody = JSON.parse(clonedRequestBody) as LLMRequest;

  const model = requestBody.parameters.model || MODEL_NAMES.DBC_BASE;

  const generate = models[model]?.generate;

  const newHeaders = new Headers();
  newHeaders.delete("www-authenticate");
  newHeaders.set("X-Accel-Buffering", "no");

  const { stream, say, close } = createOutputStream();

  if (requestBody.parameters.stream === false) {
    const res = await new Promise((resolve) => {
      generate({
        say: (message: any) => {
          if (message.generated_text) {
            resolve(message.generated_text);
          }
        },
        close: () => {},
        messages: requestBody.messages,
        parameters: requestBody.parameters,
      });
    });
    return new Response(
      JSON.stringify({ choices: [{ message: { content: res } }] }),
      {
        status: 200,
        headers: { ...newHeaders, "Content-Type": "application/json" },
      },
    );
  }

  generate({
    say,
    close,
    messages: requestBody.messages,
    parameters: requestBody.parameters,
  });

  return new Response(stream, {
    status: 200,
    headers: newHeaders,
  });
}

export const GET = handle;
export const POST = handle;
