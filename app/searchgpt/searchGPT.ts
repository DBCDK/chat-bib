//gpt endpoint (POST) /api/tgi/generate_stream
import { gql } from "@apollo/client";
import { initializeApollo } from "../client/apolloClient";

export async function searchGPT(prompt: string): Promise<string> {
  // find out if we need to perform a search
  const searchNeeded: boolean = false;
  if (searchNeeded) {
    // if yes make create search query
    //send to fbi api and get results
    //get top 10 results and choose 3 fo them
    return prompt;
  } else {
    //if not, then just send the
    return prompt;
  }
}

//evaluates if we need to make a search.
function workSearchNeeded(prompt: string) {
  console.log("workSearchNeeded.prompt: ", prompt);
  const endPoint = "/";
  const systemPrompt = "hej med dig";
}

interface User {
  name: string;
}

interface SearchData {
  user: User | null;
}

interface SearchVariables {
  input: string;
}

interface Title {
  main: string;
}

interface Manifestation {
  first: {
    cover: {
      detail_500: string;
    };
  };
}

interface Work {
  titles: Title;
  abstract: string;
  manifestations: Manifestation[];
}

interface SearchWorksData {
  search: {
    works: Work[];
  };
}

interface SearchWorksVariables {
  q: { all: string };
  offset: number;
  limit: number;
}

interface FormatedWork {
  title: string;
  cover: string;
  abstract: string;
}

function formatedWorks(works: Work[]) {
  return works.map((w) => {
    const formatedWork: FormatedWork = {
      title: w.titles.main[0],
      abstract: w.abstract[0],
      cover: w.manifestations[0]?.first?.cover?.detail_500,
    };
    return formatedWork;
  });
}
export async function searchWorks(
  queryString: string,
  offset: number = 0,
  limit: number = 10,
): Promise<FormatedWork[]> {
  const client = initializeApollo();

  const SEARCH_WORKS_QUERY = gql`
    query Example_BasicSearch(
      $q: SearchQuery!
      $offset: Int!
      $limit: PaginationLimit!
    ) {
      search(q: $q) {
        works(offset: $offset, limit: $limit) {
          titles {
            main
          }
          abstract
          manifestations {
            first {
              cover {
                detail_500
              }
            }
          }
        }
      }
    }
  `;

  try {
    const { data } = await client.query<SearchWorksData, SearchWorksVariables>({
      query: SEARCH_WORKS_QUERY,
      variables: {
        q: { all: queryString },
        offset,
        limit,
      },
    });
    console.log("data", data);

    return formatedWorks(data.search.works);
  } catch (error) {
    console.error("Error performing GraphQL search:", error);
    //  throw new Error('Failed to fetch data');
    return [];
  }
}
