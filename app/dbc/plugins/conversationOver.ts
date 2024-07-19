import { PluginContext, PluginResponse, PluginType } from ".";
import { llmGenerate } from "../llmClient";

async function process(
  args: string[],
  context: PluginContext,
): Promise<PluginResponse> {
  let text = "";
  let parsingTinyId = false;
  let currentTinyId = "";
  await llmGenerate({
    messages: [
      ...context.messages,
      {
        role: "system",
        content: `Brugeren har afsluttet samtalen, så nu giver du et venligt svar tilbage.
        `,
      },
    ],
    parameters: { max_new_tokens: 300, frequency_penalty: 0.5 },
    say: context.say,
  });

  return { nextPlugins: [], allDone: true };
}

const id = "conversation_over";
export default {
  id,
  minArgs: 0,
  maxArgs: 0,
  help: `${id}
Usage: ${id}

A command-line tool for giving the final answer to a user in a chat

Examples:
  ${id}
`,
  process,
} as PluginType;
