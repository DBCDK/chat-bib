import { gql } from "@apollo/client";
import { initializeApollo } from "@/app/client/apolloClient";
import { PluginContext, PluginResponse, PLUGINS, PluginType } from ".";
import PluginStatus from "../components/PluginStatus/PluginStatus";

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
        series {
          title
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
  { getTinyId, setContent, PLUGINS, say }: PluginContext,
): Promise<PluginResponse> {
  const [q, branchId] = args;
  const res = await fetch(
    `http://blurb-quest-1-0.mi-prod.svc.cloud.dbc.dk/?q=${encodeURIComponent(q)}&k=20`,
  );

  let works = [];
  if (Array.isArray(q)) {
    await Promise.all(
      q.map(async (qStr) => {
        PluginStatus.serialize({
          say,
          pluginName: id,
          description: `Søger efter materiale: "${qStr}" på ${branchId}`,
        });
        const r = await client.query({
          query: SEARCH_WORKS_QUERY,
          variables: {
            q: { all: qStr },
            offset: 0,
            limit: 3,
          },
        });
        works = [...r?.data?.search?.works];
      }),
    );
  } else {
    PluginStatus.serialize({
      say,
      pluginName: id,
      description: `Søger efter materiale: "${q}" på ${branchId}`,
    });
    const r = await client.query({
      query: SEARCH_WORKS_QUERY,
      variables: {
        q: { all: q },
        offset: 0,
        limit: 10,
      },
    });
    works = r?.data?.search?.works;
  }

  const formatted = works?.map((work: any) => {
    return {
      display: `${work?.titles?.full} af ${work?.creators?.map((c: any) => c.display)?.join(", ")}
${work?.abstract}
Materialetyper: ${work?.materialTypes?.map((c: any) => c?.materialTypeSpecific?.display)?.join(", ") || "ukendt"}
Udgivelsesår: ${work?.workYear?.display || "ukendt"}
workId: ${getTinyId(work.workId)}${work?.series?.[0]?.title ? `\nseriesTitle: ${work?.series?.[0]?.title}` : ""}

`,
      work,
    };
  });

  formatted.forEach((w: any) => setContent(w.work.workId, w.display));

  if (!formatted.length) {
    return {
      nextPlugins: [PLUGINS.search_at_library],
      error:
        "No works found. Try another search query, perhaps less restrictive",
    };
  }
  return {
    nextPlugins: [PLUGINS.present_works, PLUGINS.present_series],
    result: formatted?.map((w: any) => w.display),
  };
}

const id = "search_at_library";
export default {
  id,
  minArgs: 2,
  maxArgs: 2,
  help: `${id}
Usage: ${id} QUERY BRANCH_ID

A command-line tool for searching for books that are available at a specific library

Arguments:
  QUERY                A query that will find works that are relevant to the user.
  BRANCH_ID            The branchId of the library.

Examples, these are not messages from the current session:
  # You want to look for krimi at a branch
  ${id} "krimi" "751000"
    `,
  process,
} as PluginType;
