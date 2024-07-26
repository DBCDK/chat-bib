import { gql } from "@apollo/client";
import { initializeApollo } from "@/app/client/apolloClient";
import { PluginContext, PluginResponse, PluginType } from ".";
import PluginStatus from "../components/PluginStatus/PluginStatus";

const id = "fetch_library";

const client = initializeApollo();

const SEARCH_LIBRARIES = gql`
  query Get_Branches($q: String!) {
    branches(q: $q, limit: 3) {
      hitcount
      result {
        name
        branchId
        openingHours
        postalAddress
        postalCode
      }
    }
  }
`;

async function process(
  args: string[],
  context: PluginContext,
): Promise<PluginResponse> {
  let [locationMentioned, query] = args;

  const score = parseInt(locationMentioned, 10);

  if (score > 5 && query) {
    const { data = "" } = query
      ? await client.query({
          query: SEARCH_LIBRARIES,
          variables: {
            q: query,
          },
        })
      : {};

    PluginStatus.serialize({
      say: context.say,
      pluginName: id,
      description: `Søger efter bibliotek: "${query}"`,
    });

    if (data?.branches?.result?.length > 0) {
      return {
        nextPlugins: [context.PLUGINS.search_at_library],
        result: data,
      };
    }
  }

  return {
    nextPlugins: [context.PLUGINS.search],
    result: null,
  };
}

export default {
  id,
  minArgs: 2,
  maxArgs: 2,
  help: `${id}
Usage: ${id} LOCATION_MENTIONED QUERY

A command-line tool for finding a specific library based on a query

Arguments:
  LOCATION_MENTIONED         How sure are you that the user mentioned a location?
                              An int from 0 to 9 where 0 is extremely low probability, and 9 is extremely high probability.
  QUERY                      A search query for a specific library
                              A string. Empty string if no library mentioned

Examples, these are not messages from the current session:
  Example user message: "Hvilken serie kan du anbefale mig"
  ${id} 0 ""

  Example user message: "Kan du tjekke, om bogen 'Den Store Gatsby' er hjemme på Skovlunde bib?"
  ${id} 9 "Skovlunde Bibliotek"

  Example user message: "Er 'Harry Potter og De Vises Sten' tilgængelig på Herlev bibliotek?"
  ${id} 9 "Herlev Bibliotek"

  Example user message: "Hej, hvem er så du?"
  ${id} 0 ""

  Example user message: "Har Brøndby bibliotek en kopi af 'Mænd der hader kvinder'?"
  ${id} 9 "Brøndby Bibliotek"

  Example user message: "Kan du finde ud af, om 'Ringenes Herre' er hjemme på Glostrup bib?"
  ${id} 9 "Glostrup Bibliotek"

  Example user message: "Mange tak skal du have"
  ${id} 0 ""

  Example user message: "Er 'Da Vinci Mysteriet' tilgængelig på Albertslund bibliotek?"
  ${id} 9 "Albertslund Bibliotek"

  Example user message: "Fortæl mig om den nye bog af Jussi Adler"
  ${id} 0 ""

  Example user message: "Har Hvidovre 'Pigen der legede med ilden'?"
  ${id} 8 "Hvidovre Bibliotek"

  Example user message: "Goddag"
  ${id} 0 ""

End of examples

  
  

  `,
  process,
  findBestCommand: (commands: object[]) => {
    return commands[0];
  },
} as PluginType;
