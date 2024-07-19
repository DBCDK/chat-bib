import { PluginContext, PluginResponse, PluginType } from "../plugins";
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
        content: `Følgende er en liste over handlinger, der er blevet udført i denne chat-session, som du kan bruge efter behov:

    ${JSON.stringify(context.actionHistory, null, 2)}

    Svar nu så kort og præcist som muligt på de behov brugeren måtte have i sin SENESTE besked. Du skal selve vælge hvilke informationer du vil bruge fra listen over udførte handlinger.
    Sproget skal være let og flydende. Hvis du anbefaler materialer, så nævn max 2-3, medmindre brugeren har efterspurgt flere.
    Hvis du nævner en titel på et materiale (work), så det være et markdown link med url-formatet https://bibliotek.dk/materiale/m/{WORK_ID}

    Undgå at gentage dit seneste svar til brugeren
        `,
      },
    ],
    parameters: { max_new_tokens: 1500, frequency_penalty: 0.5 },
    say: (chunk: any) => {
      text += chunk?.token?.text;
      if (parsingTinyId) {
        let match = chunk?.token?.text?.match?.(/^\d+/);
        currentTinyId += match?.[0] ? match?.[0] : "";

        if (match?.[0]?.length !== chunk?.token?.text?.length) {
          parsingTinyId = false;
          const bigId = context.getBigId(currentTinyId);
          if (bigId) {
            context.say(context.getBigId(currentTinyId) + ")");
            text += context.getBigId(currentTinyId) + ")";
          } else {
            context.say(chunk);
          }

          currentTinyId = "";
        }

        return;
      }
      if (text.endsWith("materiale/m/")) {
        parsingTinyId = true;
      }
      context.say(chunk);
    }, // Remove this, if you don't want it to stream directly to client
  });

  return { nextPlugins: [], allDone: true };
}

const id = "ready_to_answer";
export default {
  id,
  minArgs: 0,
  maxArgs: 0,
  help: `${id}
Usage: ${id}

A command-line tool for answering a user in a chat

Examples:
  # All context has been fetched, so this generates the final answer back to the user
  ${id}
`,
  process,
} as PluginType;
