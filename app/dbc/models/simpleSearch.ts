import { initializeApollo } from "@/app/client/apolloClient";
import { CustomModel, GenerateRequest, Message } from "../index";
import { llmGenerate } from "../llmClient";
import { gql } from "@apollo/client";

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
  Skriv max 25 tegn om hver bog.

    Du skal lave en link til bogen i denne format: https://bibliotek.dk/work/{workId}

    Sæt workId fra de givne bøger istedet for {workId}. Eksempelvis: https://bibliotek.dk/work/work-of:870970-basis:xxxxxxxxx
  `,
  });

  // We just pass it through to the LLM backend
  await llmGenerate({
    messages: copy,
    parameters,
    say, // Remove this, if you don't want it to stream directly to client
  });

  // say("\n\nKilder:\n");
  // say(
  //   Object.values(works?.slice(0, 5))
  //     .map((s) => " * " + s.href + "\n    " + s.content)
  //     .join("\n"),
  // );
}
type SimpleSearchQuery = {
  all?: string;
  title?: string;
  creator?: string;
  subject?: string;
};

async function searchWorks(
  query: SimpleSearchQuery,
  offset: number = 0,
  limit: number = 15,
): Promise<any[]> {
  console.log("\n\n\n\nsearchWorks.query", query);
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
    const { data } = await client.query({
      query: SEARCH_WORKS_QUERY,
      variables: {
        q: query,
        offset,
        limit,
      },
    });
    console.log("\n\n\nsearchWorks", data);
    const works = data.search.works;
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
    return formatedWorks(works);
  } catch (error) {
    console.error("Error performing GraphQL search:", error);
    //  throw new Error('Failed to fetch data');
    return [];
  }
}

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

type SearchObject = {
  title?: string;
  author?: string;
  subject?: string;
};
let str = `  {"title": null,
"author": null,
"subject": "krimi"}</s>
`;
async function promptToSearchObject({
  messages,
  parameters,
  say,
}: {
  messages: Message[];
  parameters: any;
  say: Function;
}): Promise<SearchObject | null> {
  function extractJsonFromText(text: string): SearchObject | null {
    // Regular expression to find JSON object in the input string, accounting for possible newlines and spaces
    const jsonRegex = /{[^]*}/;

    // Use the regex to extract the JSON object string
    const jsonString = text.match(jsonRegex);

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

  function validateSearchObject(searchObject: SearchObject | null) {
    if (!searchObject) {
      return null;
    }
    console.log("\n\n###############################\n\n\n\n\n\n\n\n\n\n\n");
    const messagesToString = messages.map((e) => e.content).join(" ");
    console.log("\nmessagesToString", messagesToString);
    const filteredObject = Object.fromEntries(
      Object.entries(searchObject).filter(([key, value]) => {
        console.log("\n  Object.entries(searchObject).fil value", value);

        return value != null && messagesToString.includes(value);
      }),
    );
    console.log("\n\n\n\n\n\n\n\n\n\n\n#################################\n\n");
    return filteredObject;
  }
  const systemPrompt = `
Ud fra samtalen, skal du finde ud af om brugeren eftersøger en titel på en bog. En forfatter på en bog. 
Og et emne som der søges om.

Du svarer ALDRIG selv på spørgsmålet.
Du returnerer "null", hvis der ikke indegår et forfatternavn i samtalen.
Du returnerer forfatternavnet, hvis der indegår et forfatternavn i samtalen. Hvis forfatternavn ikke fremgår direkte i samtalen, må du ikke skrive den. Retunere null istedet.
Du returnerer titel, hvis der indegår en titel på en bog i samtalen. Skriv titelen præcist som den står i samtalen. Du må IKKE tilføje ekstra tekst til titlen.
Du returnerer emne, hvis der indegår et emne i samtalen. Retunere null, hvis der ikke er et emne i samtalen.

Hvis du er i tvivl om nogle af værdierne skal du retunere null. Du må ikke bare gætte. 

Du skal skrive på dansk. Kun på dansk. 

Du returnerer KUN dette json format, aldrig andet:
{"title": null | titel på bog, 
 "author": null| navn på forfatter, 
 "subject": null| emne som der skal søges på }


  `;

  const copy = [
    ...messages.filter((entry) => entry.role !== "system"),
    { role: "system", content: systemPrompt } as Message,
  ];
  const controller = new AbortController();

  const res = await llmGenerate({
    controller,
    messages: copy,
    parameters,
    say,
  });
  console.log("\n\n\n\n⏳promptToSearchObject.res", res);

  const searchObject = extractJsonFromText(res);
  console.log("\n\n\n\n⏳promptToSearchObject.searchObject", searchObject);

  const validatedSearchObject = validateSearchObject(searchObject);
  console.log("\n\n\npromptToSearchObject.searchObject", validatedSearchObject);
  return validatedSearchObject;
}

async function generate({ messages, parameters, say, close }: GenerateRequest) {
  //if (messages?.[messages?.length - 1]?.role !== "user") {
  // We just pass it through to the LLM backend

  const shouldPerformSearch = await searchIsRequired({
    messages,
    parameters,
    say,
  });
  if (shouldPerformSearch) {
    say(`\nJeg søger på bibliotek.dk.. ⏳\n`);

    const searchObject = await promptToSearchObject({
      messages,
      parameters,
      say,
    });
    // say(
    //   `\nJeg har lavet denne search object${JSON.stringify(searchObject)} \n`,
    // );

    const query =
      searchObject?.title ||
      searchObject?.author ||
      searchObject?.subject ||
      ""; //todo combine all three if they have values
    const searchQuery = {
      title: searchObject?.title,
      creator: searchObject?.author,
      subject: searchObject?.subject,
    };
    say("\n Jeg laver en søgning på  " + query + "...⏳");
    const filteredSearchQuery = Object.fromEntries(
      Object.entries(searchQuery).filter(([key, value]) => value != null),
    );
    console.log("\n\n\filteredSearchQuery", filteredSearchQuery);
    console.log("\n\nsearchObject", searchObject, "\n\n\n");

    const works = await searchWorks(filteredSearchQuery);
    console.log("\n\n 🚨🚨🚨🚨 here are the works: ", works);

    if (works.length > 0) {
      say("\nSøgning gennemført. Jeg analyserer resultaterne..\n\n");

      await finalAnswer({ messages, parameters, works, say });
      console.log("\n\n", works);
    } else {
      say("\nJeg fandt desværre ikke nogle resultater.");
    }
  } else {
    say(`\n Der er ikke behov for at lave en søgning \n`);

    await llmGenerate({
      messages,
      parameters,
      say,
    });
  }

  //  await llmGenerate({
  //   messages,
  //   parameters,
  //    say, // Remove this, if you don't want it to stream directly to client
  // });
  close();

  //}
}

export default {
  generate,
} as CustomModel;
