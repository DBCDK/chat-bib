import { NextRequest, NextResponse } from "next/server";
import { getServerSideConfig } from "@/app/config/server";
import { searchWorks } from "@/app/searchgpt/searchGPT";
import { log } from "dbc-node-logger";

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
  console.log("[Tgi Route] params ", params);

  if (req.method === "OPTIONS") {
    return NextResponse.json({ body: "OK" }, { status: 200 });
  }

  const controller = new AbortController();

  const serverConfig = getServerSideConfig();

  console.log("[TGI Url]", serverConfig.generateStreamUrl);

  const timeoutId = setTimeout(
    () => {
      controller.abort();
    },
    10 * 60 * 1000,
  );

  const fetchUrl = serverConfig.generateStreamUrl;
  const fetchOptions: RequestInit = {
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
    method: req.method,
    // to fix #2485: https://stackoverflow.com/questions/55920957/cloudflare-worker-typeerror-one-time-use-body
    redirect: "manual",
    // @ts-ignore
    duplex: "half",
    signal: controller.signal,
  };

  try {
    const decoder = new TextDecoder();

    const clonedRequestBody: any = await req.text();
    const clonedRequestBodyJson = JSON.parse(clonedRequestBody);

    const works = await searchWorks("hest");
    // console.log("\n\n\nJSON WORKS", works);
    console.log(
      "\n\n\nJSON clonedRequestBodyJson",
      clonedRequestBodyJson.inputs,
    );

    // console.log("\n\n clonedRequestBody", clonedRequestBodyJson.inputs);
    // console.log("\n\n clonedRequestBody.keys", Object.keys(clonedRequestBodyJSIN));

    const res = await fetch(fetchUrl, {
      ...fetchOptions,
      body: clonedRequestBody,
    });
    // to prevent browser prompt for credentials
    const newHeaders = new Headers(res.headers);
    newHeaders.delete("www-authenticate");
    // to disable nginx buffering
    newHeaders.set("X-Accel-Buffering", "no");

    const reader = res.body?.getReader();

    let generatedText = "";
    const stream = new ReadableStream({
      start(controller) {
        return pump();
        function pump(): any {
          return reader?.read().then(({ done, value }) => {
            // When no more data needs to be consumed, close the stream
            if (done) {
              log.info(
                JSON.stringify({
                  "llm-request": clonedRequestBody,
                  "llm-respones": generatedText,
                }),
                {
                  type: "data",
                },
              );
              controller.close();
              return;
            }
            const decodedValue = decoder.decode(value, { stream: true });
            try {
              const jsonChunk = JSON.parse(decodedValue.replace("data: ", ""));
              generatedText = jsonChunk.generated_text;
            } catch (e) {}
            // Enqueue the next data chunk into our target stream
            controller.enqueue(value);
            return pump();
          });
        }
      },
    });

    return new Response(stream, {
      status: res.status,
      statusText: res.statusText,
      headers: newHeaders,
    });
  } finally {
    clearTimeout(timeoutId);
  }
}

export const GET = handle;
export const POST = handle;
