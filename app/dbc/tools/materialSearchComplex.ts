import { initializeApollo } from "@/app/client/apolloClient";
import { gql } from "@apollo/client";
import { ToolDef } from ".";
import { GenerateRequest } from "..";
import PluginStatus from "../components/PluginStatus/PluginStatus";

const client = initializeApollo();

const SEARCH_WORKS_QUERY = gql`
  query Chatbib_ComplexSearch(
    $cql: String!
    $offset: Int!
    $limit: PaginationLimit!
    $sort: [Sort!]
  ) {
    complexSearch(cql: $cql) {
      hitcount
      errorMessage
      works(offset: $offset, limit: $limit, sort: $sort) {
        workId
        titles {
          full
        }
        creators {
          display
        }
        series {
          title
          description
          members {
            work {
              workId
              titles {
                full
              }
              abstract
            }
            numberInSeries
          }
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

const mappings: any = {
  BOOK: "literature",
  MOVIE: "movie",
  ARTICLE: "article",
  ADULT: "til voksne",
  CHILD: "til børn",
  FICTION: "fiction",
  NON_FICTION: "nonfiction",
  CHRONOLOGICAL: "sort.latestpublicationdate",
  ALPHABETICAL: "sort.title",
  ASC: "ASC",
  DESC: "DESC",
  DA: 'phrase.mainlanguage="dansk"',
  EN: 'phrase.mainlanguage="engelsk"',
};
export default {
  dependencies: [],
  schema: {
    type: "function",
    function: {
      name: "find_material",
      description:
        "Is the user interested in materials (books, movies etc.), subjects, or authors? Then this is the preferred way to search for a specific material.",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description:
              "The query should be general (preferrably in danish), not containing anything which can be set by using the additional parameters",
          },
          material_type: {
            type: "string",
            description: "The material type",
            enum: ["BOOK", "MOVIE", "ARTICLE"],
          },
          audience: {
            type: "string",
            description: "The audience",
            enum: ["ADULT", "CHILD"],
          },
          fiction: {
            type: "string",
            description: "If material should be fiction or nonfiction",
            enum: ["FICTION", "NON_FICTION"],
          },
        },
        required: ["query", "audience", "fiction"],
      },
    },
  },
  func: async (
    {
      query,
      material_type,
      audience,
      fiction,
      language,
      series,
      sort_field,
      sort_order,
    }: {
      query: string;
      material_type?: string;
      audience?: string;
      fiction?: string;
      language?: string;
      series?: boolean;
      sort_field?: string;
      sort_order?: string;
    },
    input: GenerateRequest,
  ) => {
    let cql = `"${query}"`;
    if (material_type) {
      cql += ` AND worktype="${mappings[material_type] || "literature"}"`;
    }
    if (fiction) {
      cql += ` AND term.fictionnonfiction="${mappings[fiction] || "fiction"}"`;
    }
    if (audience) {
      cql += ` AND term.childrenoradults="${mappings[audience] || "til voksne"}"`;
    }
    // if (language) {
    cql += ` AND ${mappings[language || ""] || mappings["DA"]}`;
    // }

    let sort;
    if (mappings[sort_field || ""]) {
      sort = [
        {
          index: mappings[sort_field || ""],
          order: mappings[sort_order || ""] || "DESC",
        },
      ];
    }

    PluginStatus.serialize({
      say: input.say,
      pluginName: "find_material",
      description: `Søger efter materiale: ${cql}`,
    });

    const limit = 10;

    const r = await client.query({
      query: SEARCH_WORKS_QUERY,
      variables: {
        cql: cql,
        sort: sort,
        offset: 0,
        limit,
      },
    });
    const works = r?.data?.complexSearch?.works;

    let formatted;

    formatted = works?.map((work: any) => {
      return {
        display: `${work?.titles?.full} af ${work?.creators?.map((c: any) => c.display)?.join(", ")}
      ${work?.abstract}
      Materialetyper: ${work?.materialTypes?.map((c: any) => c?.materialTypeSpecific?.display)?.join(", ") || "ukendt"}
      Udgivelsesår: ${work?.workYear?.display || "ukendt"}
      workId: ${work.workId}
      
      `,
        work,
      };
    });

    return {
      request: { query, material_type, audience, fiction, language, series },
      response: formatted.slice(0, 10).map((w: any) => w.display),
    };
  },
} as ToolDef;
