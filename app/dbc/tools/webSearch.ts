import { ToolDef } from ".";
import { GenerateRequest } from "..";
import { search } from "../clients/brave";
import PluginStatus from "../components/PluginStatus/PluginStatus";

export default {
  dependencies: [],
  schema: {
    type: "function",
    function: {
      name: "web_search",
      description:
        "Is the user asking about stuff that can't be found with the other tools?",
      parameters: {
        type: "object",
        properties: {
          queries: {
            type: "array",
            description:
              "A list of search engine queries (preferrably in danish), min 1 max 3",
            items: {
              type: "string",
            },
          },
        },
        required: ["queries"],
      },
    },
  },
  func: async (
    {
      queries,
    }: {
      queries: string[];
    },
    input: GenerateRequest,
  ) => {
    const searchResults: any = [];
    for (let i = 0; i < queries.length; i++) {
      const q = queries[i];

      await new Promise((r) => setTimeout(r, 1200));
      PluginStatus.serialize({
        say: input.say,
        pluginName: "web_search",
        description: `Laver websøgning: ${q}...`,
      });

      const results = await search(q);

      searchResults.push(results?.slice(0, 5));
    }

    return {
      request: { queries },
      response: searchResults.slice(0, 2),
    };
  },
} as ToolDef;
