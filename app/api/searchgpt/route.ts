import { NextRequest, NextResponse } from "next/server";
import { getServerSideConfig } from "@/app/config/server";

async function handle(req: NextRequest) {
  if (req.method === "OPTIONS") {
    return NextResponse.json({ body: "OK" }, { status: 200 });
  }
  const controller = new AbortController();
  const serverConfig = getServerSideConfig();

  const { searchParams } = new URL(req.url);
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
  const clonedRequestBody: any = await req.text();
  const clonedRequestBodyJson = JSON.parse(clonedRequestBody);

  // console.log("\n\n\nJSON WORKS", works);
  console.log("\n\n\nJSON clonedRequestBodyJson", clonedRequestBodyJson.inputs);

  // console.log("\n\n clonedRequestBody", clonedRequestBodyJson.inputs);
  // console.log("\n\n clonedRequestBody.keys", Object.keys(clonedRequestBodyJSIN));

  //   const res = await fetch(fetchUrl, {
  //     ...fetchOptions,
  //     body: clonedRequestBody,
  //   });

  const response = await fetch("/api/tgi/generate_stream", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: clonedRequestBody,
  });

  const query = searchParams.get("p");
  console.log("\n\n\n\nquery", query);
  //todo get this from body
  const s = {
    inputs:
      "<s>[INST] <<SYS>>\n" +
      "Dette er et resumé af chat-historikken som en genopfriskning: \n" +
      "jeg vil gerne finde en bog om nutella" +
      "\n" +
      "<</SYS>>\n" +
      "</s>",
    parameters: {
      temperature: 0.3,
      max_tokens: 4000,
      max_new_tokens: 500,
      presence_penalty: 0,
      frequency_penalty: 0,
      stream: false,
    },
  };

  if (req.method === "GET" || req.method === "POST") {
    return NextResponse.json({ message: s }, { status: 200 });
  }

  return NextResponse.json(
    { error: true, message: "Method not allowed" },
    { status: 405 },
  );
}

export const GET = handle;
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
