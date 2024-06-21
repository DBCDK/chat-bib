//gpt endpoint (POST) /api/tgi/generate_stream
import { gql } from "@apollo/client";
import { initializeApollo } from "../client/apolloClient";
import { getServerSideConfig } from "@/app/config/server";

export interface Prompt {
  inputs: string;
  parameters: {
    temperature: number;
    max_tokens: number;
    max_new_tokens: number;
    presence_penalty: number;
    frequency_penalty: number;
    stream: boolean;
  };
}

const promptExample: Prompt = {
  inputs:
    "<s>[INST] <<SYS>>\n" +
    "Dette er et resumé af chat-historikken som en genopfriskning: \n" +
    "jeg vil gerne finde en bog om nutella" +
    "\n" +
    "<</SYS>>\n" +
    "</s>",
  parameters: {
    temperature: 0.3,
    max_tokens: 4000,
    max_new_tokens: 500,
    presence_penalty: 0,
    frequency_penalty: 0,
    stream: false,
  },
};

export async function searchGPT(prompt: Prompt): Promise<Prompt> {
  // let modifiedPrompt = prompt;
  // find out if we need to perform a search
  const searchNeeded = searchIsneeded(prompt);

  if (searchNeeded) {
    // if yes make create search query
    const searchQuery = await promptToSearchQuery(prompt);
    console.log("\nsearchQuery", searchQuery);
    //send to fbi api and get results
    const works = await searchWorks(searchQuery);
    console.log("\n\n\nworks", works);
    //get top 10 results and choose 3 fo them
    return prompt; //JSON.stringify(promptObject);
  } else {
    //if not, then just send the
    return prompt;
  }
}
function searchIsneeded(prompt: Prompt): boolean {
  // Define keywords that might indicate a search or book-finding intent
  const keywords = [
    "find",
    "finde",
    "søge",
    "søg",
    "bog",
    "lokalisere",
    "forslag",
    "anbefale",
    "anbefal",
  ];

  // Convert the prompt to lowercase to make the search case-insensitive
  const lowerPrompt = prompt.inputs.toLowerCase();

  // Check if any of the keywords are present in the prompt
  const searchNeeded = keywords.some((keyword) =>
    lowerPrompt.includes(keyword),
  );

  return searchNeeded;
}

//will add a text to a prompt
function modifyPrompt(prompt: Prompt, newPromptText: string) {
  return {
    // ...prompt,
    parameters: { ...prompt.parameters, stream: false },
    inputs: `<s>[INST] <<SYS>>\n\n\n\n${newPromptText}. ${prompt.inputs}<</SYS>>[/INST]`,
  };
}
//will send prompt to mixtral server and returns the respnse
async function sendPrompt(prompt: Prompt) {
  const controller = new AbortController();
  const serverConfig = getServerSideConfig();
  const fetchUrl = serverConfig.generateStreamUrl;
  const fetchOptions: RequestInit = {
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
    method: "POST",
    // to fix #2485: https://stackoverflow.com/questions/55920957/cloudflare-worker-typeerror-one-time-use-body
    redirect: "manual",
    // @ts-ignore
    duplex: "half",
    signal: controller.signal,
  };
  console.log("prompt", prompt);
  // Send the modified prompt to your generative AI
  const res = await fetch(fetchUrl, {
    ...fetchOptions,
    body: JSON.stringify(prompt),
  });

  const body = await res.text();
  const trimmedBody: string = body.replaceAll("data: {", " {");
  const arr = trimmedBody.split("\n");
  const query: string = arr
    .map((item) => {
      try {
        return JSON.parse(item);
      } catch {
        return null;
      }
    })
    .find((obj) => obj && obj.generated_text !== null);

  return query.generated_text?.replaceAll('"', "");
}
async function promptToSearchQuery(prompt: Prompt): Promise<string> {
  const decoder = new TextDecoder();
  const propmtText = `Generate a search query for the following. Make it as short as possible. Don't use OR|AND|NOT etc. The query should be in danish. don't use words like "about","for" etc. Search query can max be 2 words. Return only the query. Dont comment anything about it`;
  const modifiedPrompt = modifyPrompt(prompt, propmtText);
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

// interface SearchData {
//   user: User | null;
// }

// interface SearchVariables {
//   input: string;
// }

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
  console.log("\nsearchWorks.queryString", queryString);
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
    console.log("\n\n\nsearchWorks", data);
    return formatedWorks(data.search.works);
  } catch (error) {
    console.error("Error performing GraphQL search:", error);
    //  throw new Error('Failed to fetch data');
    return [];
  }
}
