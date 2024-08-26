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
      name: "find_series",
      description:
        "Is the user asking about a material that is part of a series?",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description:
              "The query should be general (and preferably in danish), not containing anything which can be set by using the additional parameters",
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

          // language: {
          //   type: "string",
          //   type: "string",
          //   description: "Main language of the material",
          //   enum: ["DA", "EN"],
          // },
          // sort_field: {
          //   type: "string",
          //   description: "Sort with chronological or by popularity",
          //   enum: ["CHRONOLOGICAL", "POPULARITY"],
          // },
          // sort_order: {
          //   type: "string",
          //   description: "Sort order of result",
          //   enum: ["ASC", "DESC"],
          // },
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
      sort_field,
      sort_order,
      succesCriteria,
    }: {
      query: string;
      material_type?: string;
      audience?: string;
      fiction?: string;
      language?: string;
      series?: boolean;
      sort_field?: string;
      sort_order?: string;
      succesCriteria: string;
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

    PluginStatus.serialize({
      say: input.say,
      pluginName: "find_series",
      description: `Søger efter serie: "${cql}"`,
    });
    let sort;
    if (mappings[sort_field || ""]) {
      sort = [
        {
          index: mappings[sort_field || ""],
          order: mappings[sort_order || ""] || "DESC",
        },
      ];
    }

    const r = await client.query({
      query: SEARCH_WORKS_QUERY,
      variables: {
        cql: cql,
        sort: sort,
        offset: 0,
        limit: 100,
      },
    });
    const works = r?.data?.complexSearch?.works;

    let formatted;

    let uniqueSeries: any = {};
    works?.forEach((work: any) => {
      const seriesTitle = work?.series?.[0]?.title;
      if (seriesTitle && !uniqueSeries[seriesTitle]) {
        uniqueSeries[seriesTitle] = {
          seriesId: work.workId?.replace("work-of", "series-of"),
          seriesTitle,
          seriesDescription: work?.series?.[0]?.description,
          members: work?.series?.[0]?.members?.map((member: any) => {
            return {
              workId: member.work.workId,
              workTitle: member.work.titles?.full,
              numberInSeries: member.numberInSeries,
            };
          }),
        };
      }
    });

    return {
      request: { query, material_type, audience, fiction, language },
      response: Object.values(uniqueSeries).slice(0, 5),
    };
  },
} as ToolDef;
