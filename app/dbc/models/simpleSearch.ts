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

    Du skal lave en link til bogen i denne format: https://bibliotek.dk/work/{workId}

    Sæt workId fra de givne bøger istedet for {workId}. Eksempelvis: https://bibliotek.dk/work/work-of:xxxxxx-basis:xxxxxxxxx
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

async function searchWorks(
  query: string,
  offset: number = 0,
  limit: number = 15,
): Promise<any[]> {
  console.log("\nsearchWorks.query", query);
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
        q: { all: query },
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
    // Regular expression to match JSON object in text
    const jsonPattern = /\{.*?\}/;
    const match = text.match(jsonPattern);

    if (match) {
      try {
        // Parse the matched JSON string into a JavaScript object
        const jsonObject = JSON.parse(match[0]);
        return jsonObject;
      } catch (e) {
        console.error("Failed to parse JSON:", e);
        return null;
      }
    } else {
      console.log("No JSON found in text.");
      return null;
    }
  }

  const systemPrompt = `
Ud fra samtalen, skal du finde ud af om brugeren eftersøger en titel på en bog. En forfatter på en bog. 
Og et emne som der søges om.



Du svarer ALDRIG selv på spørgsmålet.
Du returnerer "intetForfatterNavn", hvis der ikke indegår et forfatternavn i samtalen.
Du returnerer forfatternavnet, hvis der indegår et forfatternavn i samtalen. Hvis forfatter navn ikke fremgår direkte i samtalen, må du ikke skrive den. Retunere null istedet.
Du returnerer titel, hvis der indegår en titel på en bog i samtalen. Skriv titelen præcist som den står i samtalen. Du må IKKE tilføje ekstra tekst til titlen.
Du returnerer forfatternavnet, hvis der indegår et forfatternavn i samtalen. Retunere null, hvis der ikke er et emne i samtalen.

Hvis du er i tvivl om nogle af værdierne skal du retunere null. Du må ikke bare gætte. 

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

  const searchObject = extractJsonFromText(res);
  console.log("searchObject", searchObject);
  return searchObject;
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

    say("\n Jeg laver en søgning på  " + query + "...⏳");

    const works = await searchWorks(query);
    say("\nSøgning gennemført. Jeg analyserer resultaterne..");

    await finalAnswer({ messages, parameters, works, say });
    console.log("\n\n", works);
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
