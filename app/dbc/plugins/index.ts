import { GenerateRequest, Message } from "..";
import PluginStatus from "../components/PluginStatus/PluginStatus";
import { llmGenerate } from "../llmClient";
import conversationOver from "./conversationOver";
import fetchLibraryInfo from "./fetchLibraryInfo";
import findSeries from "./findSeries";
import initial from "./initial";
import presentWorks from "./presentWorks";
import readyToAnswer from "./readyToAnswer";
import searchForWorks from "./searchForWorks";
import searchForWorksAtLibrary from "./searchForWorksAtLibrary";

export type PluginType = {
  id: string;
  help: string;
  minArgs: number;
  maxArgs: number;
  findBestCommand?: Function;
  process: (args: string[], context: PluginContext) => Promise<PluginResponse>;
};
export type PluginResponse = {
  nextPlugins: PluginType[];
  result?: any;
  error?: string;
  allDone?: Boolean;
};
interface PluginMap {
  [key: string]: PluginType;
}

export const PLUGINS: PluginMap = {
  [initial.id]: initial,
  [searchForWorks.id]: searchForWorks,
  [searchForWorksAtLibrary.id]: searchForWorksAtLibrary,
  [readyToAnswer.id]: readyToAnswer,
  [fetchLibraryInfo.id]: fetchLibraryInfo,
  [presentWorks.id]: presentWorks,
  [conversationOver.id]: conversationOver,
  [findSeries.id]: findSeries,
};

export type PluginContext = {
  messages: Message[];
  say: Function;
  getTinyId: (bigId: string, content?: string) => string;
  getBigId: (tinyId: string) => string | undefined;
  getContent: (bigId: string) => string | undefined;
  setContent: (bigId: string, content: string) => void;
  actionHistory: object[];
  PLUGINS: PluginMap;
  init?: any;
};

export function createLLMWithPlugins({
  rootPlugins,
  final,
}: {
  rootPlugins: PluginType[];
  final: PluginType;
}) {
  async function generate({
    messages,
    say,
    close,
    conversationId,
  }: GenerateRequest) {
    let currentTinyId = 1;
    const getTinyIdMap: any = {};
    const getBigIdMap: any = {};
    const getBigIdToContentMap: any = {};
    let actionHistory: object[] = [];
    const context: PluginContext = {
      actionHistory,
      messages,
      say,
      getTinyId: (bigId: string, content?: string) => {
        getBigIdToContentMap[bigId] = content;
        let tinyId = getTinyIdMap[bigId];
        if (!tinyId) {
          tinyId = currentTinyId + "";
          getTinyIdMap[bigId] = tinyId;
          getBigIdMap[tinyId] = bigId;
          currentTinyId++;
        }
        return tinyId;
      },
      getBigId: (tinyId: string) => {
        let bigId = getBigIdMap[tinyId];
        return bigId;
      },
      setContent: (bigId: string, content: string) => {
        getBigIdToContentMap[bigId] = content;
      },
      getContent: (bigId: string) => {
        return getBigIdToContentMap[bigId];
      },
      PLUGINS,
    };

    PluginStatus.serialize({
      say: context.say,
      pluginName: "",
      description: "Analyserer forespørgsel",
    });
    // say("Jeg er her for dig");

    // let actionHistory: any = getActionHistory(conversationId);
    let repeatedActions: any = [];
    let plugins = rootPlugins;

    for (let i = 0; i < 15; i++) {
      let action = await getNextAction({
        plugins,
        messages,
        actionHistory,
        repeatedActions,
      });

      if (!action?.id) {
        // It didnt find an action ID in time
        // actionHistory.push(action);
        break;
      }

      const orgAction = plugins.find((a2) => a2.id === action?.id) || final;

      if (orgAction.id === final.id) {
        break;
      }
      if (action) {
        if (
          actionHistory.find(
            (oldAction: any) =>
              oldAction.id === action.id &&
              JSON.stringify(oldAction.arguments) ===
                JSON.stringify(action.arguments),
          )
        ) {
          say(`Action: ${JSON.stringify(action)} - called again, FAIL now\n`);
          break;
        }

        // say(`Action: ${orgAction.id} - ${action.arguments.join(", ")}\n`);

        action.result = await orgAction.process(action.arguments, context);

        if (action?.result?.nextPlugins) {
          plugins = action?.result?.nextPlugins;
        }
        if (action?.result?.allDone) {
          close();
          return;
        }

        actionHistory.push(action);
      }
    }

    say(`\n`);

    await final.process([], context);

    close();
  }

  return { generate };
}

async function getNextAction({
  plugins,
  messages,
  actionHistory,
}: {
  plugins: PluginType[];
  messages: Message[];
  actionHistory: object[];
  repeatedActions?: object[];
}) {
  let text = "";
  let res: any;
  const controller = new AbortController();

  const systemPrompt: Message = {
    role: "system",
    content: `You are the planner part of an intelligent assistant, designed to help users by making decisions based on their chat history and interactions with various services. Your goal is to determine the next best action to take based on the information provided by these services. You should check if enough context has been gathered to answer the user’s query or if more data needs to be fetched. If additional information is required, you should identify the appropriate service to call next. You don't answer the user directly.

**Plugin call history:**
${JSON.stringify(
  actionHistory.map((a: any) => ({
    command: a.orgCommand,
    result: a.result?.result,
    error: a.result?.error,
  })),
  null,
  2,
)}

**List of command-line tools ready to be called now:**
${plugins
  ?.map((action) => action.help)
  .filter((d) => !!d)
  .join("\n\n")}

**Rules for selecting plugin to be called next:**
- Read the chat history as well as the already performed actions thoroughly
- Focus primarily on the message with the highest msgSequenceId, read further back for context
- It is OK to call the same tool multiple times, as long as the parameters differ
- Do NOT call a tool with parameters you have already used

**Notes on Response Structure:**
 - A command and its arguments should be on a single line. 
 - Each argument should be wrapped in double quotes, like "some argument".
 - You write 5 alternative commands one per line. 
 - The line you have most confidence in must come first.
 - Each line ends with a score (on the same line), one of [S1,S2,S3,S4,S5]. This is a score of your own performance.
   Scores:
     - S1: You did terrible
     - S2: You did OK, maybe you wasn't sure about some arguments
     - S3: You are pretty sure you picked up on the users intention, and filled out the arguments correctly
     - S4: You did very well, understood the user, and filled out arguments
     - S5: You actually did a perfect job, understood the user, and filled out arguments perfectly
 - After writing the 5 suggested commands, you will reason about you choices on a new line.

Are you ready?

`,
  };

  let commands: any[] = [];
  let offset = 0;
  const allText = await llmGenerate({
    controller,
    messages: [
      ...messages
        .filter((m) => m.role !== "system")
        .map((m, index) => ({
          sequenceId: index + 1,
          ...m,
          content: `msgSequenceId: ${index + 1}\n${m.content}`,
        })),
      systemPrompt,
      {
        role: "assistant",
        content: `Yes, I am ready!
I will be very careful not to call these commands again as I already got a response for those:
${actionHistory.map((a: any) => a.orgCommand).join("\n")}

And then I will take special care of picking the best command-line tool for the job, making sure that the arguments is set correctly based on the chat history. 
I will suggest 5 alternative commands to call next, where the one I have most confidence in comes first, and I will score my own performance, with S1-S5 at the end of each line.

Command-line tool to call:

`,
      },
    ],
    parameters: { temperature: 0.4, max_new_tokens: 200, top_p: 0.95 },
    say: (chunk: any) => {
      if (res) return;

      text += chunk?.token?.text?.replace(/\\/g, "") || "";

      let lines = text.split("\n");
      lines = lines.map((line: string, index: number) =>
        index === lines.length - 1 ? line : line + "\n",
      );
      //   console.log("lines: ", lines);
      //   console.log("Processing new chunk:", chunk);
      //   console.log("Current text:", text);

      for (let i = offset; i < lines.length; i++) {
        let line = lines[i];

        const cmd = parseCommand(line, plugins);
        if (line.length > 25 && !cmd?.id) {
          res = {};
          controller.abort();
        }
        if (cmd?.valid) {
          commands[i] = cmd;

          if (cmd.plugin?.findBestCommand) {
            const bestCommand = cmd.plugin?.findBestCommand(
              commands.filter((c) => !!c),
            );
            if (bestCommand) {
              res = bestCommand;
              controller.abort();
            }
          } else {
            res = cmd;
            controller.abort();
          }
        }
      }
    },
  });

  return res;
}

function parseCommand(input: string, plugins: PluginType[]) {
  input = input.replace(/\\/g, "");
  input = input.replace(/<\/s>/g, "");

  let score = input.match(/S\d/)?.[0];
  input = score ? input.replace(new RegExp(score, "g"), "") : input;

  // Split the command string using regex to handle quoted strings and spaces
  const parts = input.match(/\S+\s*/g) || [];

  let command;
  let commandPos = 0;
  let plugin;
  for (let i = 0; i < parts.length; i++) {
    let str = parts[i].replace(/[^a-zA-Z_]/g, "");
    plugin = plugins.find((p) => p.id === str);
    if (plugin) {
      command = str;
      commandPos = i;
      break;
    }
  }
  if (!command) {
    return;
  }
  let args = [];
  let currentArg = "";
  let inDoubleQuotes = false;
  let inSingleQuotes = false;
  for (let i = commandPos + 1; i < parts.length; i++) {
    currentArg += parts[i];

    let trimmed = currentArg.trim();

    if (trimmed.startsWith('"')) {
      inDoubleQuotes = true;
    }
    if (trimmed.startsWith("'")) {
      inSingleQuotes = true;
    }

    if (inDoubleQuotes && trimmed.endsWith('"') && trimmed.length > 1) {
      inDoubleQuotes = false;
      args.push(trimmed);
      currentArg = "";
      continue;
    }

    if (inSingleQuotes && trimmed.endsWith("'") && trimmed.length > 1) {
      inSingleQuotes = false;
      args.push(trimmed);
      currentArg = "";
      continue;
    }

    if (
      !inSingleQuotes &&
      !inDoubleQuotes &&
      (currentArg.endsWith(" ") || currentArg.endsWith("\n"))
    ) {
      args.push(trimmed);
      currentArg = "";
      continue;
    }
  }

  let valid = true;
  if (currentArg) {
    valid = false;
  } else if (args.length < (plugin?.minArgs || 0)) {
    valid = false;
  } else if (!input.endsWith("\n") && args.length < (plugin?.maxArgs || 0)) {
    valid = false;
  }
  args = args.slice(0, plugin?.maxArgs);

  // Build the output object
  return {
    valid,
    id: command,
    arguments: args
      .filter((arg) => !!arg)
      .map((arg) => arg.replace(/"/g, "").replace(/'/g, "").trim()),
    command: `${command} ${args
      .map((arg) => `"${arg.replace(/"/g, "").replace(/'/g, "").trim()}"`)
      .join(" ")}`,
    plugin,
    score: score?.replace("S", ""),
  };
}
