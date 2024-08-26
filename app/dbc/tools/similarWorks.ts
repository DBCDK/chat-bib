import { initializeApollo } from "@/app/client/apolloClient";
import { gql } from "@apollo/client";
import { ToolDef } from ".";
import { GenerateRequest } from "..";
import PluginStatus from "../components/PluginStatus/PluginStatus";
import findSeries from "./findSeries";
import materialSearchComplex from "./materialSearchComplex";

const client = initializeApollo();

const SEARCH_WORKS_QUERY = gql`
  query Chatbib_WorkRecommendations($pid: String!, $limit: Int!) {
    recommend(pid: $pid, limit: $limit) {
      result {
        work {
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
  }
`;

export default {
  dependencies: [materialSearchComplex, findSeries],
  schema: {
    type: "function",
    function: {
      name: "find_similar",
      description:
        "Is the user looking for inspiration based on specific series or material?",
      parameters: {
        type: "object",
        properties: {
          workId: {
            type: "string",
            description:
              "the ID of a work. Find it by calling find_material or find_series",
          },
          seriesId: {
            type: "string",
            description: "the ID of a series. Find it by calling find_series",
            enum: ["BOOK", "MOVIE", "ARTICLE"],
          },
        },
        oneOf: ["workId", "seriesId"],
      },
    },
  },
  func: async (
    {
      workId,
      seriesId,
    }: {
      workId?: string;
      seriesId?: string;
    },
    input: GenerateRequest,
  ) => {
    PluginStatus.serialize({
      say: input.say,
      pluginName: "find_series",
      description: `Minder om: "${workId || seriesId}"`,
    });
    if (workId && !workId.startsWith("work-of")) {
      return (
        "Error, invalid workId " + workId + ". Use find_series or find_material"
      );
    }
    if (seriesId && !seriesId.startsWith("series-of")) {
      return "Error, invalid seriesId " + seriesId + ". Use find_series";
    }

    const r = await client.query({
      query: SEARCH_WORKS_QUERY,
      variables: {
        limit: 10,
        pid: workId
          ? workId.replace("work-of:", "")
          : seriesId?.replace("series-of:", ""),
      },
    });

    let uniqueSeries: any = {};
    r?.data?.recommend?.result?.forEach((w: any) => {
      console.log("haha", w);
      const work = w.work;
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
      request: { workId, seriesId },
      response: Object.values(uniqueSeries)
        .filter((series: any) => !seriesId || series?.seriesId !== seriesId)
        .slice(0, 5),
    };
  },
} as ToolDef;
