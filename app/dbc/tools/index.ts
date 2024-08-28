import { log } from "dbc-node-logger";
import { GenerateRequest, Message } from "..";
import { getServerSideConfig } from "@/app/config/server";
import PluginStatus from "../components/PluginStatus/PluginStatus";
import { createPlanner } from "./planner";

const config = getServerSideConfig();

export interface ToolSchema {
  type: "function";
  function: ToolSchemaFunction;
}

export interface ToolSchemaFunction {
  name: string;
  description: string;
  parameters?: {
    type: "object";
    properties: Properties;
    required?: string[];
  };
}

export interface Properties {
  [key: string]: {
    type: string;
    description: string;
  };
}

export interface ToolDef {
  schema: ToolSchema;
  dependencies: ToolDef[];
  func: Function;
}

function jsonToText(jsonObj: any, indent = 0) {
  let result = "";
  const indentSpace = " ".repeat(indent * 2);

  for (let key in jsonObj) {
    if (typeof jsonObj[key] === "object" && jsonObj[key] !== null) {
      result += `${indentSpace}${key}:\n`;
      result += jsonToText(jsonObj[key], indent + 1);
    } else {
      result += `${indentSpace}${key}: ${jsonObj[key]}\n`;
    }
  }

  return result;
}

export async function tgiGroqToolClient({
  tools,
  request,
}: {
  tools: ToolDef[];
  request: GenerateRequest;
}) {
  const fetchOptions: RequestInit = {
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
    method: "POST",
    redirect: "manual",
  };

  function createInput(messages: Message[], tools: ToolDef[]) {
    let inputs = `<|start_header_id|>system<|end_header_id|>

You are a function calling AI model. You are provided with function signatures within <tools></tools> XML tags. You may call one or more functions to assist with the user query. Don't make assumptions about what values to plug into functions. For each function call return a json object with function name and arguments within <tool_call></tool_call> XML tags as follows:
<tool_call>
{"name": <function-name>,"arguments": <args-dict>}
</tool_call>

Here are the available tools:
<tools> ${JSON.stringify(
      tools.map((tool) => tool.schema),
      null,
      2,
    )} </tools><|eot_id|>`;

    messages
      .filter((m) => m.role !== "system")
      .forEach((m: any, index) => {
        inputs += `<|start_header_id|>${m.role === "user" ? "user" : "assistant"}<|end_header_id|>

`;
        if (m.role === "tool") {
          inputs += `<tool_call>
{"id":"call_${index}","name":"${m.name}","arguments":${JSON.stringify(m.arguments)}}
</tool_call><|eot_id|><|start_header_id|>tool<|end_header_id|>

<tool_response>
{"id":"call_${index}","result":"${m.content}"}
</tool_response><|eot_id|><|start_header_id|>assistant<|end_header_id|>`;
        } else {
          inputs += m.content;
        }
      });

    inputs += "<|start_header_id|>assistant<|end_header_id|>\n\n<tool_call>";
    return inputs;
  }

  const requestBodyStr = JSON.stringify({
    inputs: createInput(request.messages, tools),
    model: "tgi",
    temperature: 0.5,
    max_new_tokens: 600,
    max_tokens: 4500,
    top_p: 0.65,
    stream: false,
    stop: null,
  });

  try {
    const now = performance.now();
    const res = await fetch(config.tgiGroqUrl || "", {
      ...fetchOptions,
      body: requestBodyStr,
    });
    const json = await res.json();

    log.info(
      JSON.stringify({
        url: config.tgiGroqUrl,
        "llm-request": requestBodyStr,
        "llm-response": json.generated_text,
        timeToFirstToken: performance.now() - now,
      }),
      {
        type: "data",
      },
    );

    return { function: JSON.parse(json.generated_text) };
  } catch (e) {
    return { error: "Could not make function call" };
  }
}

export async function generate({
  tools: allTools,
  defaultTool,
  request,
  toolClient,
}: {
  tools: ToolDef[];
  defaultTool: ToolDef;
  request: GenerateRequest;
  toolClient: any;
}) {
  let messages = [
    ...request.messages?.filter((m) => m.role !== "system"),
  ] as any;
  let didRespond = false;

  const planner = createPlanner(allTools);

  const plannerParams = await toolClient({
    tools: [planner],
    request: {
      ...request,
      messages,
    },
  });
  const plannerResult = await planner.func(plannerParams?.function.arguments, {
    ...request,
    messages,
  });

  messages.push({
    tool_call_id: plannerParams.id,
    role: "tool",
    name: plannerParams?.function?.name,
    arguments: plannerParams?.function.arguments,
    content: plannerResult.plan,
  });

  const tools = plannerResult.tools;
  const forceQueue = true;

  for (let i = 0; i < 5; i++) {
    let selectedTools = forceQueue ? [tools[i]] : tools;

    if (selectedTools.filter((t: any) => !!t).length === 0) {
      break;
    }
    const toolParams = await toolClient({
      tools: selectedTools,
      request: {
        ...request,
        messages,
      },
    });

    if (toolParams?.error) {
      PluginStatus.serialize({
        say: request.say,
        pluginName: "fejl",
        description: `Tool kald fejlede ${toolParams?.function?.name}`,
      });

      messages.push({
        role: "system",
        content: `Tool call failed with error ${toolParams?.error}`,
      });
      continue;
    }

    let tool = tools.find(
      (tool: any) => tool.schema.function.name === toolParams?.function?.name,
    );

    if (!tool) {
      tool = defaultTool;
    }
    let toolRes = "";
    if (
      messages.find(
        (m: any) =>
          m?.name === toolParams?.function?.name &&
          JSON.stringify(m?.arguments) ===
            JSON.stringify(toolParams?.function.arguments),
      )
    ) {
      PluginStatus.serialize({
        say: request.say,
        pluginName: "fejl",
        description: `Tool allerede kaldt med argumenter`,
      });
      toolRes =
        "ERROR: Do not repeat tool calls. Tool already called with arguments: " +
        jsonToText(toolParams?.function.arguments);
    } else {
      console.log(
        "Calling:",
        tool.schema.function.name,
        toolParams?.function.arguments,
      );
      toolRes = await tool.func(
        toolParams?.function.arguments,
        {
          ...request,
          messages,
        },
        allTools,
      );
    }

    if (!toolRes) {
      didRespond = true;
      // We are done
      //   request.say("We are done");
      return;
    }

    // Add result from function call, and start over
    messages.push({
      tool_call_id: toolParams.id,
      role: "tool",
      name: toolParams?.function?.name,
      arguments: toolParams?.function.arguments,
      content: jsonToText(toolRes),
    });
  }

  if (!didRespond) {
    await defaultTool.func(
      {},
      {
        ...request,
        messages,
      },
    );
  }
}
