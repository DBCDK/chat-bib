import { PluginContext, PluginResponse, PLUGINS, PluginType } from ".";
import Carousel from "../components/Carousel/Carousel";
import PluginStatus from "../components/PluginStatus/PluginStatus";
import { llmGenerate } from "../llmClient";

const id = "present_works";
async function process(
  args: string[],
  context: PluginContext,
): Promise<PluginResponse> {
  if (!args.length) {
    return {
      nextPlugins: [PLUGINS.search, PLUGINS.present_works],
      error: `Invalid workIds`,
    };
  }
  const [seriesPresentation, workPresentation] = args;
  const seriesPresentationScore = parseInt(seriesPresentation, 10);
  const workPresentationScore = parseInt(workPresentation, 10);

  const workIds = args.slice(2, 5);
  let validWorkIds = workIds
    .map((workId) => context.getBigId(workId))
    .filter((workId) => !!workId);

  if (!validWorkIds.length) {
    return {
      nextPlugins: [PLUGINS.search, PLUGINS.present_works],
      error: `Invalid workIds`,
    };
  }

  if (seriesPresentationScore > workPresentationScore) {
    // context.say("I will present as series some day");
  }
  PluginStatus.serialize({
    say: context.say,
    pluginName: id,
    description: `Præsenterer materialer: ${validWorkIds.join(", ")}`,
  });

  Carousel.serialize({ say: context.say, workIds: validWorkIds as string[] });

  await llmGenerate({
    messages: [
      ...context.messages,
      {
        role: "system",
        content: `Du har fået til opgave at præsentere en række materialer til slutbrugeren. Du skal læse brugerens beskeder nøje og sammenholde med de materialer du skal præsentere.

Her er materialerne:

${JSON.stringify(
  validWorkIds.map((w) => context.getContent(w || "")),
  null,
  2,
)}

Du skal nu lave en kort opsummering af de valgte materialer, og hvorfor de passer godt.

Hvis de ikke passer godt, skal du også sige det, og spørge om du fx skal lede efter noget andet. Du skal ikke nævne workId'er eller forsøge at lave links.

`,
      },
    ],
    parameters: { max_new_tokens: 1500, frequency_penalty: 0.5 },
    say: context.say,
  });

  return {
    nextPlugins: [],
    result: "",
    allDone: true,
  };
}

export default {
  id,
  minArgs: 1,
  maxArgs: 10,
  help: `${id}
Usage: ${id} PRESENT_AS_SERIES PRESENT_AS_INDEPENDENT_WORKS WORK_IDS...

A command-line tool for presenting a list of works to the user
As soon as you have found one or more work that are suitable to the users need, call this

Arguments:
  PRESENT_AS_SERIES             Could the user be interested in an entire series?
                                 An int from 0 to 9 where 0 is extremely low probability, and 9 is extremely high probability.

  PRESENT_AS_INDEPENDENT_WORKS  Could the user be interested in an entire series?
                                 An int from 0 to 9 where 0 is extremely low probability, and 9 is extremely high probability.

  WORK_IDS                      A list of up to workIds.

Examples, these are not messages from the current session:
  User Message: Kender du Harry Potter serien?
  ${id} 9 0 5 9 11

  User Message: Har du Harry Potter og de Vises Sten?
  ${id} 3 9 26 19 2
    `,
  process,
} as PluginType;
