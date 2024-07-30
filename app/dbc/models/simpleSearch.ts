import { initializeApollo } from "@/app/client/apolloClient";
import { CustomModel, GenerateRequest, Message, MODEL_NAMES } from "../index";
import { llmGenerate } from "../llmClient";
import { gql } from "@apollo/client";
import MaterialCard from "../components/MaterialCard/MaterialCard";
import { ModelDescription } from "./modelsDescriptions";
//TODO MOVE TO A SHARED FILE!
interface FormatedWork {
  title: string;
  cover: string;
  abstract: string;
  workId: string;
}
async function finalAnswer({
  messages,
  parameters,
  works,
  say,
}: {
  messages: Message[];
  works: FormatedWork[];
  parameters: any;
  say: Function;
}) {
  const copy = [...messages];
  copy.push({
    role: "system",
    content: `Disse er nogle bøger, som du SKAL bruge til at besvare spørgsmål. Du må kun bruge disse bøger. 
  
 bøger:  ${JSON.stringify(works)}
    
  Svar så kort og præcist som muligt. Giv mindst 5 anbefalinger. Du må KUN finde anbefalinger fra de bøger som jeg har givet dig.

  For hver bog, SKAL du skrive en sætning der fortæller om bogen. 

    Du skal lave en link til bogen i denne format: https://bibliotek.dk/work/{workId}

    Sæt workId fra de givne bøger istedet for {workId}. Eksempelvis: https://bibliotek.dk/work/work-of:870970-basis:xxxxxxxxx

    Vis en liste med en sætning der fortæller om bogen, link til bibliotek.dk samt titlen på bogen.
  `,
  });

  // We just pass it through to the LLM backend
  const finalAnswer = await llmGenerate({
    messages: copy,
    parameters,
    say, // Remove this, if you don't want it to stream directly to client
  });
  say("\n\n\n\n");
  works.forEach((work) => {
    if (finalAnswer.includes(work.workId)) {
      MaterialCard.serialize({ say, workId: work.workId });
    }
  });
}
type SimpleSearchQuery = {
  q: {
    all?: string;
    title?: string;
    creator?: string;
    subject?: string;
    [key: string]: any; // Add this line
  };
  filters?: Filters;
};

export async function searchWorks(
  query: SimpleSearchQuery,
  offset: number = 0,
  limit: number = 35,
): Promise<FormatedWork[]> {
  //remove null values
  const filteredSearchQuery = Object.fromEntries(
    Object.entries(query.q).filter(([key, value]) => value != null),
  );
  const filteredFilters = Object.fromEntries(
    Object.entries(query.filters ?? {}).filter(([key, value]) => value != null),
  );

  console.log("\n\n\n\n\n\n filteredFilters", filteredFilters + "\n\n\n");
  console.log(
    "\n\n\n\n\n\n filteredSearchQuery",
    filteredSearchQuery + "\n\n\n",
  );

  const client = initializeApollo();

  const SEARCH_WORKS_QUERY = gql`
    query Example_BasicSearch(
      $q: SearchQueryInput!
      $offset: Int!
      $limit: PaginationLimitScalar!
      $filters: SearchFiltersInput!
    ) {
      search(q: $q, filters: $filters) {
        works(offset: $offset, limit: $limit) {
          workId
          titles {
            main
          }
          abstract
          manifestations {
            latest {
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
    console.log(
      "\n\n\n\n\n\n 🚧 searchWorks QUERY: ",
      JSON.stringify({
        q: filteredSearchQuery,
        filters: filteredFilters,
        offset,
        limit,
      }) + "\n\n\n",
    );
    const { data } = await client.query({
      query: SEARCH_WORKS_QUERY,
      variables: {
        q: filteredSearchQuery,
        filters: filteredFilters,
        offset: 0,
        limit: 35,
      },
    });
    //filter for works that has an abstract. Look only on the first 15 works
    const works = data?.search?.works
      ?.filter((w: any) => w?.abstract[0]?.length > 0)
      .slice(0, 15);

    function formatedWorks(works: any[]) {
      return works.map((w) => {
        const formatedWork = {
          title: w.titles.main[0],
          abstract: w.abstract[0],
          cover: w.manifestations[0]?.first?.cover?.detail_500,
          workId: w.workId,
        };
        return formatedWork;
      });
    }
    console.log("\n\n\n\n\n\n\n works length: " + works.length);
    return formatedWorks(works);
  } catch (error) {
    console.error("Error performing GraphQL search:", error);
    //  throw new Error('Failed to fetch data');
    return [];
  }
}

//TODO only check the latest message
async function searchIsRequired({
  messages,
  parameters,
  say,
}: {
  messages: Message[];
  parameters: any;
  say: Function;
}): Promise<Boolean> {
  const systemPrompt = `
Ud fra samtalen, skal du finde ud af om der er behov for at finde en bog.

Hvis spørgsmålet ikke er relateret til bøger, er der ikke behov for at finde en bog.


Du svarer ALDRIG selv på spørgsmålet.
Du returnerer 1, hvis der er behov for at finde en bog
Du returnerer 0, hvis der IKKE er behov for at finde en bog.
ns står for needSearch

Du returnerer KUN dette json format, aldrig andet:
{"ns": 1|0, "reasonForSearch": "..."}


  `;

  const copy = [
    ...messages.filter((entry) => entry.role !== "system"),
    { role: "system", content: systemPrompt } as Message,
  ];
  const controller = new AbortController();

  const res = await new Promise(async (resolve) => {
    let text = "";
    let shouldSearch = false;
    await llmGenerate({
      controller,
      messages: copy,
      parameters,
      say: (chunk: any) => {
        text += chunk?.token?.text || "";
        const noSpaces = text.replace(/\s/g, "");
        console.log("text", text);
        if (noSpaces.includes('"ns":1')) {
          shouldSearch = true;
          controller.abort();
        } else if (noSpaces.includes('"ns":0')) {
          controller.abort();
        }
      },
    });
    resolve(shouldSearch);
  });

  return res as Boolean;
}

type Query = {
  title?: string;
  creator?: string;
  subject?: string;
  all?: string;
};

type Filters = {
  mainLanguages?: string[];
  workTypes?: string[];
  childrenOrAdults?: string;
  year?: string | number;
};

type SearchObject = Query &
  Filters & {
    [key: string]: any; // Add this line
  };
export async function promptToSearchObject({
  messages,
  parameters,
  say,
}: {
  messages: Message[];
  parameters: any;
  say: Function;
}): Promise<{ query: Query; filters?: Filters }> {
  function extractJsonFromText(text: string): SearchObject | null {
    // Regular expression to find JSON object in the input string, accounting for possible newlines and spaces
    const jsonRegex = /{[^]*}/;

    // Use the regex to extract the JSON object string
    const jsonString = text?.replaceAll("</s>", "").match(jsonRegex);

    if (jsonString) {
      try {
        // Parse the JSON string into an object
        const jsonObject = JSON.parse(jsonString[0]);
        return jsonObject;
      } catch (error) {
        console.error("Failed to parse JSON:", error);
        return null;
      }
    } else {
      console.error("No JSON object found in the input string.");
      return null;
    }
  }

  /**
   * Validates
   * @param searchObject
   * @returns
   */

  function validateQuery(searchObject: SearchObject | null): Query {
    if (!searchObject) {
      return {};
    }
    //only user messages
    const messagesToString = messages
      .map((e) => (e.role == "user" ? e.content : ""))
      .join(" ")
      .toLowerCase();

    //filter for null values
    let filteredObject = Object.fromEntries(
      Object.entries(searchObject).filter(([key, value]) => {
        console.log("\n  Object.entries(searchObject).filter value", value);
        return (
          value != null
          // TODO: improve this.  && messagesToString.includes(String(value).toLowerCase())
        );
      }),
    );

    if (!filteredObject.all && filteredObject.subject?.split(" ").length > 1) {
      filteredObject.all = filteredObject.subject + "";
      delete filteredObject.subject;
    }
    // if(filteredObject?.all){
    //   filteredObject.all = filteredObject.all.replaceAll(" og "," ");

    // }
    console.log("\n🍕beforefilteredObject", searchObject);

    console.log("\n🍕filteredObject", filteredObject);

    console.log("\n\n\n\n\n\n\n\n\n\n\n#################################\n\n");
    return filteredObject;
  }

  function extractFiltersFromSearchObject(searchObject: SearchObject): Filters {
    const filterKeys: (keyof Filters)[] = [
      "mainLanguages",
      "workTypes",
      "childrenOrAdults",
      "year",
    ];

    // Extract the filter object based on the keys from filterKeys
    const filters = filterKeys.reduce((acc, key) => {
      const value = searchObject[key];
      if (key === "mainLanguages" && Array.isArray(searchObject[key])) {
        acc[key] = (searchObject[key] as string[]).map(
          (language) => language.charAt(0).toUpperCase() + language.slice(1),
        );
      }

      // Ensure the value is of the correct type before adding it to the filters object
      else if (key === "workTypes") {
        if (Array.isArray(value)) {
          acc[key] = value;
        }
      } else if (key === "childrenOrAdults" && typeof value === "string") {
        acc[key] = value;
      } else if (
        key === "year" &&
        (typeof value === "string" || typeof value === "number")
      ) {
        acc[key] = value;
      }

      return acc;
    }, {} as Filters);

    return filters;
  }

  function extractQueryFromSearchObject(searchObject: SearchObject): Query {
    const queryKeys: (keyof Query)[] = ["title", "creator", "subject", "all"];
    const query = queryKeys.reduce((acc, key) => {
      if (key in searchObject) {
        acc[key] = searchObject[key];
      }
      return acc;
    }, {} as Query);

    return query;
  }

  const systemPrompt = `
Ud fra samtalen, skal du finde ud af om brugeren eftersøger en titel på en bog. En forfatter på en bog. 
Og et emne som der søges om.

Du svarer ALDRIG selv på spørgsmålet.
Du returnerer "null", hvis der ikke indegår et forfatternavn i samtalen.
Du returnerer forfatternavnet, hvis der indegår et forfatternavn i samtalen. Hvis forfatternavn ikke fremgår direkte i samtalen, må du ikke skrive den. Retunere null istedet.
Du returnerer titel, hvis der indegår en titel på en bog i samtalen. Skriv titelen præcist som den står i samtalen. Du må IKKE tilføje ekstra tekst til titlen.
Du returnerer emne, hvis der indegår et emne i samtalen. Retunere null, hvis der ikke er et emne i samtalen.
Hvis der er noget i samtalen som er relevant for søgningen og som ikke er et emne, en titel, eller en forfatter, skal du sætte den i "all".

Hvis du er i tvivl om nogle af værdierne skal du retunere null. Du må ikke bare gætte. 

Du skal skrive på dansk. Kun på dansk. 

Du returnerer KUN dette json format, aldrig andet:
{"title": titel på bog, 
 "creator": navn på forfatter,
 "subject":  emne som der skal søges på,
 "all": general søgning for flere ord,
 "mainLanguages": liste ad sprog som der ønskes. Hvis flere sprog retunere et array. Skriv det fulde navn. på dansk. (eksempelvis "dansk", "engelsk", "fransk"),
 "childrenOrAdults":  "til børn" eller "til voksne",
 "workTypes": liste af typer af materialer. Det kan kun være en eller flere af følgende værdier. [Bøger, Artikler, Film, Musik, Spil ],
  }

  Retunere ikke felterne, hvis de ikke har en værdi. Der skal være et komma mellem felterne.
  `;

  /**
   * 
 "year": hvis det specifikt nævnes, tilføj årstallet for udgivelsen
   */

  //filters: fictionalCharacters, childrenOrAdults ("til voksne" eller "til børn"), year

  const copy = [
    ...messages.filter((entry) => entry.role !== "system"),
    { role: "system", content: systemPrompt } as Message,
  ];
  const controller = new AbortController();

  const res = await llmGenerate({
    controller,
    messages: copy,
    parameters,
    // say,
  });
  console.log("\n\n\n\n⏳promptToSearchObject.res", res);

  const searchObject = extractJsonFromText(res);
  console.log("\n\n\n\n⏳promptToSearchObject.searchObject", searchObject);

  const query = extractQueryFromSearchObject(searchObject || {});
  const validatedSearchObject = validateQuery(query);
  console.log("\n\n\nalidatedSearchObject.searchObject", validatedSearchObject);
  const filters = extractFiltersFromSearchObject(searchObject || {});

  console.log("\n\n\n🍊alidatedSearchObject.filters", filters);
  console.log("\n\n\n🔧alidatedSearchObject.query", query);

  return { query: validatedSearchObject, filters: filters };
}

async function generate({ messages, parameters, say, close }: GenerateRequest) {
  const shouldPerformSearch = await searchIsRequired({
    messages,
    parameters,
    say,
  });

  if (shouldPerformSearch) {
    say(`\nAnalyserer⏳\n`);

    const searchObject = await promptToSearchObject({
      messages,
      parameters,
      say,
    });

    say(
      "\nJeg laver en søgning til simple search🔎 \n\n" +
        JSON.stringify(searchObject) +
        "\n\n",
    );

    if (Object.keys(searchObject).length > 0) {
      const searchQuery = {
        q: {
          ...searchObject.query,

          //   creator: searchObject?.query?.author,
        },
        filters: { ...searchObject.filters },
        // title: searchObject?.query?.title,
        // creator: searchObject?.query?.author,
        // subject: searchObject?.query?.subject,
        // all: searchObject?.query?.all,
      };
      console.log(
        "\n\n\n\n\n\n\n\nLaver søgning til simple search: ",
        JSON.stringify(searchQuery),
      );

      say(
        "\nfilters searchquery: 🔎\n\n searchQuery " +
          JSON.stringify(searchQuery) +
          "\n\n\n",
      );
      const works = await searchWorks(searchQuery);

      if (works.length > 0) {
        say("\nSøgning gennemført. Jeg analyserer resultaterne..\n\n");

        await finalAnswer({ messages, parameters, works, say });
      } else {
        say("\nJeg fandt desværre ikke nogle resultater.");
      }
    } else {
      say("\nKunne ikke lave en søge query fra din prompt.\n");
    }
  } else {
    // say(`\n Der er ikke behov for at lave en søgning \n`);

    await llmGenerate({
      messages,
      parameters,
      say,
    });
  }

  close();
}

export const modelDescription: ModelDescription = {
  name: MODEL_NAMES.DBC_SIMPLE_SEARCH,
  description:
    "En model til at udføre enkle søgninger på bøger baseret på brugerinput. Brug denne model hvis der skal findes eller anbefales en bog. Prioritere denne model hvis der skal findes bøger.",
};

export default {
  generate,
} as CustomModel;
