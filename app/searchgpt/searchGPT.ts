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
    const csQuery = await promptToComplexSearchQuery(prompt);
    console.log("\n\n\n\nCCCSCSCSCSSSssSSsearchQuery", csQuery, "\n");
    //send to fbi api and get results
    const works = await searchWorks(searchQuery);
    console.log("\n\n\nworks", works);
    const finalPropmpt = generateSearchPrompt(prompt, works);
    return finalPropmpt;
  } else {
    //if not, then just send the
    return prompt;
  }
}

function generateSearchPrompt(prompt: Prompt, works: FormatedWork[]) {
  const messages = llmFormatToMessages(prompt.inputs);
  console.log("\n\n\n\ngenerateSearchPrompt.messages", messages);
  const lastUserMessage =
    messages.reverse().find((message) => message.role === "user") ||
    messages[messages.length - 1];

  console.log("\n\n\n\ngenerateSearchPrompt.lastUserMessage", messages);

  const newPrompt = { ...prompt, inputs: llmFormat([lastUserMessage]) };
  //get top 10 results and choose 3 fo them
  console.log("newPrompt", newPrompt);
  const finalPropmpt = modifyPrompt(
    newPrompt,
    `Basere dit svar på følgende data: ${JSON.stringify(works)}. send workId i dit svar.`,
  );
  console.log("\nfinalPropmpt", finalPropmpt);

  return finalPropmpt;
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
async function sendPrompt(prompt: Prompt): Promise<string> {
  const controller = new AbortController();
  const serverConfig = getServerSideConfig();
  const fetchUrl = serverConfig.generateUrl;
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
  console.log("sendPrompt.prompt", prompt);
  // Send the modified prompt to your generative AI
  const res = await fetch(fetchUrl, {
    ...fetchOptions,
    body: JSON.stringify(prompt),
  });
  const body = await res.json();
  return body.generated_text;
}
async function promptToSearchQuery(prompt: Prompt): Promise<string> {
  const decoder = new TextDecoder();
  const propmtText = `Generate a search query for the following. Make it as short as possible. Don't use OR|AND|NOT etc. The query should be in danish. don't use words like "about","for" etc. Search query can max be 2 words. Return only the query. Dont comment anything about it. Return only the query and dont say anything more in your respnse. Your answer can max be 2 words.`;
  const promptText2 =
    "Convert the following prompt into a search query of maximum 2 words. Write in danish";
  const promptText3 =
    "Find keywords from the following prompt. I want to use the keywords for a search. Be preceice. ";

  const modifiedPrompt = modifyPrompt(prompt, propmtText);

  const res = await sendPrompt(modifiedPrompt);
  const words = res.split(" ");

  const firstTwoWords = words.slice(0, 2).join(" ");

  return res;
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
  workId: string;
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
  workId: string;
}

function formatedWorks(works: Work[]) {
  return works.map((w) => {
    const formatedWork: FormatedWork = {
      title: w.titles.main[0],
      abstract: w.abstract[0],
      cover: w.manifestations[0]?.first?.cover?.detail_500,
      workId: w.workId,
    };
    return formatedWork;
  });
}
export async function searchWorks(
  queryString: string,
  offset: number = 0,
  limit: number = 15,
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
          workId
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
    //   console.log("\n\n\nsearchWorks", data);
    return formatedWorks(data.search.works);
  } catch (error) {
    console.error("Error performing GraphQL search:", error);
    //  throw new Error('Failed to fetch data');
    return [];
  }
}

type Message = {
  role: "system" | "user" | "assistant";
  content: string;
};

const llmFormatToMessages = (llm: string): Message[] => {
  const messages: Message[] = [];

  const systemRegex = /<s>\[INST\] <<SYS>>\n([\s\S]*?)\n<<\/SYS>>\n\n/;
  const systemMatch = llm.match(systemRegex);

  if (systemMatch) {
    messages.push({
      role: "system",
      content: systemMatch[1],
    });
    llm = llm.replace(systemRegex, "");
  }

  const parts = llm.split(/<\/s><s>\[INST\]|\[\/INST\]/).filter(Boolean);

  for (let i = 0; i < parts.length; i++) {
    messages.push({
      role: i % 2 === 0 ? "user" : "assistant",
      content: parts[i].trim(),
    });
  }

  return messages;
};

export const llmFormat = (msgs: Message[]): string => {
  let result = "<s>[INST] <<SYS>>\n";
  if (msgs[0]?.role === "system") {
    result += msgs.shift()?.content || "";
  }
  result += "\n<</SYS>>\n\n";

  msgs.forEach((msg) => {
    result += msg.content;
    result += msg.role === "assistant" ? "</s><s>[INST]" : "[/INST]";
  });

  return result;
};

async function promptToComplexSearchQuery(prompt: Prompt): Promise<string> {
  const decoder = new TextDecoder();
  const propmtText = `
  Transform user input into a CQL query using the following structure:

  1. Extract keywords and phrases from the user input.
  2. Identify the logical operators: AND, OR, NOT.
  3. Combine extracted keywords using the identified logical operators.
  4. Ensure proper syntax for each search index based on the complex search documentation.
  5. Only the signs <, <=, >, >= are used between index and value.
  6. you are not allowed to use the sign <> . Use NOT before the statement instead.
  7. send the query only. Don not send ny other information than the query. 


  CQL Indexes and Descriptions:

  - age: Specific age or range of ages (e.g., age="1-3")
  - ages: Suggested age group, using operators like <, <=, >, >=, within (e.g., ages > 5)
  - datefirstedition: Year of the first edition, using operators like <, <=, >, >=, within (e.g., datefirstedition > 2021)
  - dk5: Danish classification system values (e.g., dk5="85")
  - firstaccessiondate: First acquisition date, using operators like <, <=, >, >=, within (e.g., firstaccessiondate > 2020-05-01)
  - hascover: Indicates if the material has a cover image (true/false)
  - let: Reading ability index value (e.g., let="12")
  - lix: Readability index value (e.g., lix="28")
  - mediacouncilagerestriction: Media council age restriction, using operators like <, <=, >, >=, within (e.g., mediacouncilagerestriction > 11)
  - pegi: PEGI minimum age, using operators like <, <=, >, >=, within (e.g., pegi > 15)
  - pid: Search for pids (e.g., pid=870970-basis:44069938)
  - publicationyear: Publication year, using operators like <, <=, >, >=, within (e.g., publicationyear > 2021)
  - worktype: Type of work (e.g., worktype="article")
  - workyear: Year of earliest published edition, using operators like <, <=, >, >=, within (e.g., workyear > 1999)
  - phrase.accesstype: Physical or online materials (e.g., phrase.accesstype=online)
  - phrase.ages: Material intended for a specific age (e.g., phrase.ages="for 11 år")
  - phrase.cataloguecode: Catalogue code (e.g., phrase.cataloguecode="BKM202310")
  - phrase.childrentopic: Children topics (e.g., phrase.childrentopic="venskaber")
  - phrase.contributor: Contributors (e.g., phrase.contributor="charlie chaplin")
  - phrase.contributorfunction: Specific type of contributor (e.g., phrase.contributorfunction="Rane Knudsen (oversætter)")
  - phrase.creator: Creator of material (e.g., phrase.creator="kim leine")
  - phrase.creatorcontributor: Contributors or creators (e.g., phrase.creatorcontributor="charlie chaplin")
  - phrase.creatorcontributorfunction: Specific type of creator or contributor (e.g., phrase.creatorcontributorfunction="kim leine (forfatter)")
  - phrase.creatorfunction: Specific type of creator (e.g., phrase.creatorfunction="Lucy Dillon (forfatter)")
  - phrase.fictionalcharacter: Fictional characters (e.g., phrase.fictionalcharacter="Sherlock*")
  - phrase.filmnationality: Nationality of films (e.g., phrase.filmnationality="japanske film")
  - phrase.gameplatform: Gaming platforms (e.g., phrase.gameplatform="playstation 4")
  - phrase.generalaudience: Intended audience (e.g., phrase.generalaudience="let at læse")
  - phrase.generalmaterialtype: General material types (e.g., phrase.generalmaterialtype="musik")
  - phrase.genreandform: Specific genres or literary forms (e.g., phrase.genreandform=digte)
  - phrase.hostpublication: Host publication of an article (e.g., phrase.hostpublication="Information")
  - phrase.issue: Specific issue (e.g., phrase.issue="2021-11-03")
  - phrase.language: Language of materials (e.g., phrase.language=dansk)
  - phrase.libraryrecommendation: Recommended age group (e.g., phrase.libraryrecommendation="fra 7 år")
  - phrase.mainlanguage: Primary language of materials (e.g., phrase.mainlanguage=dansk)
  - phrase.mediacouncilagerestriction: Media council age restriction (e.g., phrase.mediacouncilagerestriction="Frarådes børn under 7 år*")
  - phrase.mood: Mood of material (e.g., phrase.mood="sarkastisk")
  - phrase.musicalensembleorcast: Musical ensemble or cast (e.g., phrase.musicalensembleorcast="For klaver")
  - phrase.narrativetechnique: Narrative techniques (e.g., phrase.narrativetechnique="almindeligt sprog")
  - phrase.pegi: PEGI descriptions (e.g., phrase.pegi="pegi: 7")
  - phrase.players: Number of players (e.g., phrase.players="for 2 spillere")
  - phrase.primarytarget: Primary intended target of material (e.g., phrase.primarytarget="folkeskoleniveau")
  - phrase.series: Series titles and universes (e.g., phrase.series="krimiserien med martin juncker og signe kristiansen")
  - phrase.setting: Setting of material (e.g., phrase.setting="futuristisk")
  - phrase.specificmaterialtype: Specific material types (e.g., phrase.specificmaterialtype="bog")
  - phrase.spokenlanguage: Spoken languages of movies (e.g., phrase.spokenlanguage=tysk)
  - phrase.subject: Subjects (e.g., phrase.subject="efterforskning")
  - phrase.subtitlelanguage: Subtitle languages of movies (e.g., phrase.subtitlelanguage=dansk)
  - phrase.typeofscore: Type of score (e.g., phrase.typeofscore="Studienpartitur")
  - term.accesstype: Physical or online materials (e.g., term.accesstype=online)
  - term.canalwaysbeloaned: Items that can always be loaned (true/false)
  - term.childrenoradults: Materials for children or adults (e.g., term.childrenoradults="til voksne")
  - term.childrentopic: Children topics (e.g., term.childrentopic="venskaber")
  - term.contributor: Contributors (e.g., term.contributor="charlie chaplin")
  - term.creator: Names of creators (e.g., term.creator="kim leine")
  - term.creator_notes: Notes fields combined with creator (e.g., term.creator_notes="Krummelurpille")
  - term.schooluse: Materials for school use (e.g., term.schooluse="til skolebrug")
  - term.creatorcontributor: Contributors or creators (e.g., term.creatorcontributor="charlie chaplin")
  - term.default: Default search on title, creator, subject, and material type (e.g., "kim leine" AND karolines)
  - term.dk5heading: Text representations of DK5 codes (e.g., term.dk5heading="Grønlands historie")
  - term.fictionalcharacter: Fictional characters (e.g., term.fictionalcharacter="Sherlock*")
  - term.fictionnonfiction: Fiction or non-fiction (e.g., term.fictionnonfiction="fiction")
  - term.function: Specific type of creator or contributor (e.g., term.function="forfatter kim leine")
  - term.gameplatform: Gaming platforms (e.g., term.gameplatform="playstation 4")
  - term.generalmaterialtype: General material types (e.g., term.generalmaterialtype="musik")
  - term.genreandform: Specific genres or literary forms (e.g., term.genreandform=digte)
  - term.hostpublication: Host publication of an article (e.g., term.hostpublication="Information")
  - term.isbn: ISBN of books (e.g., term.isbn="9781911215387")
  - term.mainlanguage: Primary language of materials (e.g., term.mainlanguage=dansk)
  - term.mood: Mood of material (e.g., term.mood="tankevækkende")
  - term.narrativetechnique: Narrative techniques (e.g., term.narrativetechnique="alvidende")
  - term.publisher: Publisher of material (e.g., term.publisher="Scanbox*")
  - term.schooluse: Materials for school use (e.g., term.schooluse="til skolebrug")
  - term.series: Series titles and universes (e.g., term.series="krimiserien med martin juncker og signe kristiansen")
  - term.setting: Setting of material (e.g., term.setting="storbyen")
  - term.source: Names of sources in the data well (e.g., term.source=bibliotekskatalog)
  - term.specificmaterialtype: Specific material types (e.g., term.specificmaterialtype="bog")
  - term.spokenlanguage: Spoken languages of movies (e.g., term.spokenlanguage=tysk)
  - term.subject: Subjects (e.g., term.subject="efterforskning")`;

  const modifiedPrompt = modifyPrompt(prompt, propmtText);

  const res = await sendPrompt(modifiedPrompt);

  return res;
}
