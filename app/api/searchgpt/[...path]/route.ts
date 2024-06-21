import { NextRequest, NextResponse } from "next/server";
import { getServerSideConfig } from "@/app/config/server";
import { Prompt, searchGPT, searchWorks } from "@/app/searchgpt/searchGPT";
import { prettyObject } from "@/app/utils/format";
//import { log } from "dbc-node-logger";

/**
 * This is a route handler for accessing models running on DBC's infrastructure
 * using the generate_stream endpoint
 *
 * TODO implement some kind of auth mechanism
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
    const promptObject: Prompt = JSON.parse(clonedRequestBody);

    console.log("\nclonedRequestBodyclonedRequestBody\n", promptObject);
    // let promptObject = JSON.parse(clonedRequestBody);

    const searchGPTPropmpt = await searchGPT(promptObject);

    //console.log('\nsearchGPTPropmpt\n',searchGPTPropmpt)

    // // console.log("\n\n\nJSON WORKS", works);
    // console.log(
    //   "\n\n\nJSON clonedRequestBodyJson",
    //   promptObject.inputs,
    // );

    // console.log("\n\n clonedRequestBody", clonedRequestBodyJson.inputs);
    // console.log("\n\n clonedRequestBody.keys", Object.keys(clonedRequestBodyJSIN));

    const res = await fetch(fetchUrl, {
      ...fetchOptions,
      body: JSON.stringify(searchGPTPropmpt),
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
              // log.info(
              //   JSON.stringify({
              //     "llm-request": clonedRequestBody,
              //     "llm-respones": generatedText,
              //   }),
              //   {
              //     type: "data",
              //   },
              // );
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

// async function handleOLD(req: NextRequest) {
//   if (req.method === "OPTIONS") {
//     return NextResponse.json({ body: "OK" }, { status: 200 });
//   }

//   try {
//     const clonedRequestBody: any = await req.text();
//     console.log('\nclonedRequestBodyclonedRequestBody\n',clonedRequestBody)
//     let promptObject = JSON.parse(clonedRequestBody);

//     const searchGPTPropmpt = searchGPT(promptObject);

//     console.log('\nearchGPTPropmpt\n',searchGPTPropmpt)

//     // Redirect to the specified URL
//     return NextResponse.rewrite(new URL("/api/tgi/generate_stream", req?.url));

//     // const url = req.nextUrl.clone();
//     // url.pathname = "/api/tgi/generate_stream";
//     // return NextResponse.rewrite(url);
//   } catch (e) {
//     console.error("[OpenAI] ", e);
//     return NextResponse.json(prettyObject(e));
//   }

//return NextResponse.rewrite("/api/tgi/generate_stream");

// const controller = new AbortController();
// const serverConfig = getServerSideConfig();

// const { searchParams } = new URL(req.url);
// const fetchUrl = serverConfig.generateStreamUrl;
// const fetchOptions: RequestInit = {
//   headers: {
//     "Content-Type": "application/json",
//     "Cache-Control": "no-store",
//   },
//   method: req.method,
//   // to fix #2485: https://stackoverflow.com/questions/55920957/cloudflare-worker-typeerror-one-time-use-body
//   redirect: "manual",
//   // @ts-ignore
//   duplex: "half",
//   signal: controller.signal,
// };
// const clonedRequestBody: any = await req.text();
// const clonedRequestBodyJson = JSON.parse(clonedRequestBody);
// return NextResponse.rewrite("/api/tgi/generate_stream");

// console.log("\n\n\nJSON WORKS", works);
//console.log("\n\n\nJSON clonedRequestBodyJson", clonedRequestBodyJson.inputs);

// console.log("\n\n clonedRequestBody", clonedRequestBodyJson.inputs);
// console.log("\n\n clonedRequestBody.keys", Object.keys(clonedRequestBodyJSIN));

//   const res = await fetch(fetchUrl, {
//     ...fetchOptions,
//     body: clonedRequestBody,
//   });

//   const response = await fetch("/api/tgi/generate_stream", {
//     method: "POST",
//     headers: {
//       "Content-Type": "application/json",
//     },
//     body: clonedRequestBody,
//   });

// const query = searchParams.get("p");
// console.log("\n\n\n\nquery", query);
// //todo get this from body
// const s = {
//   inputs:
//     "<s>[INST] <<SYS>>\n" +
//     "Dette er et resumé af chat-historikken som en genopfriskning: \n" +
//     "jeg vil gerne finde en bog om nutella" +
//     "\n" +
//     "<</SYS>>\n" +
//     "</s>",
//   parameters: {
//     temperature: 0.3,
//     max_tokens: 4000,
//     max_new_tokens: 500,
//     presence_penalty: 0,
//     frequency_penalty: 0,
//     stream: false,
//   },
// };

// if (req.method === "GET" || req.method === "POST") {
//   return NextResponse.json({ message: s }, { status: 200 });
// }
//}

//export const GET = handle;
export const POST = handle;

export const runtime = "edge";

let messages = [
  { role: "user", content: "jeg vil gerne finde en bog om nutella" },
];
const requestExample = {
  //mabe
  inputs: messages,
  parameters: {
    temperature: 0.3,
    max_tokens: 4000,
    max_new_tokens: 500,
    presence_penalty: 0,
    frequency_penalty: 0,
    stream: false,
  },
};
