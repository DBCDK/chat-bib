import { gql } from "@apollo/client";
import { initializeApollo } from "@/app/client/apolloClient";
import { PluginContext, PluginResponse, PLUGINS, PluginType } from ".";

const client = initializeApollo();

const SEARCH_WORKS_QUERY = gql`
  query Example_BasicSearch(
    $q: SearchQuery!
    $offset: Int!
    $limit: PaginationLimit!
  ) {
    search(q: $q) {
      works(offset: $offset, limit: $limit) {
        workId
        titles {
          full
        }
        creators {
          display
        }
        abstract
        manifestations {
          first {
            cover {
              detail_500
            }
          }
        }
        materialTypes {
          materialTypeSpecific {
            display
          }
        }
        workYear {
          display
        }
      }
    }
  }
`;

async function process(
  args: string[],
  { getTinyId, getBigId, PLUGINS, say }: PluginContext,
): Promise<PluginResponse> {
  say("her kommer præsentation af serien: " + getBigId(args[0]));
  return {
    nextPlugins: [],
    allDone: true,
    result: "",
  };
}

const id = "present_series";
export default {
  id,
  minArgs: 1,
  maxArgs: 1,
  help: `${id}
Usage: ${id} SERIES_ID

A command-line tool for presenting a series of works to a user
You should call this, if the user wants an overview of an entire series, or the user looks for books or movies that
you know is a part of a series.

Arguments:
  SERIES_ID                The seriesId of the series

Examples, these are not messages from the current session:
  Context: ...seriesId: 5...
  User message: "Kan du give mig en oversigt over 'Harry Potter' bøgerne?"
  ${id} 5

  Context: ...seriesId: 9...
  User message: "Jeg vil gerne se alle filmene i 'Ringenes Herre' serien."
  ${id} 9

  Context: ...seriesId: 3...
  User message: "Har du en liste over alle 'Game of Thrones' bøgerne?"
  ${id} 3

  Context: ...seriesId: 4...
  User message: "Kan du vise mig alle 'Star Wars' filmene?"
  ${id} 4

  Context: ...seriesId: 5...
  User message: "Jeg leder efter alle bøgerne i 'The Wheel of Time' serien."
  ${id} 5
    `,
  process,
} as PluginType;
