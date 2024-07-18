import { initializeApollo } from "@/app/client/apolloClient";
import { CustomModel, GenerateRequest, Message } from "../index";
import { llmGenerate } from "../llmClient";
import { gql } from "@apollo/client";

const allowedIndexes = [
  { searchIndexes: "term.general", description: "general friktestsøgning" },
  { searchIndexes: "term.title", description: "søg efter titel på bog" },
  { searchIndexes: "term.creatorcontributor", description: "forfatternavn" },
  { searchIndexes: "term.subject", description: "emne" },
  {
    searchIndexes: "phrase.mainlanguage",
    description:
      "Sprog. SKRIV SPROGET PÅ DANSK. Skriv fulde navn på sproget. Eksempelvis: fransk, spansk, italiensk osv.) SKRIV SPROGET PÅ DANSK!",
  },
  // {
  //   searchIndexes: "worktype",
  //   description:
  //     "materiale type. Det kan kun være én af følgende (literature (bøger) , article(artikler), movie (film), music(musik), game(spil)",
  // },
];

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
  await llmGenerate({
    messages: copy,
    parameters,
    say, // Remove this, if you don't want it to stream directly to client
  });
}

export async function searchByCQL(
  cql: string,
  offset: number = 0,
  limit: number = 35,
): Promise<FormatedWork[]> {
  const client = initializeApollo();

  const COMPLEX_SEARCH_QUERY = gql`
    query Example_ComplexSearch(
      $cql: String!
      $offset: Int!
      $limit: PaginationLimit!
    ) {
      complexSearch(cql: $cql) {
        hitcount
        errorMessage
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
    const { data } = await client.query({
      query: COMPLEX_SEARCH_QUERY,
      variables: {
        cql: cql,
        offset,
        limit,
      },
    });

    console.log("🍊🚧🍊🚧🍊🚧COMPLEX data QUERY 🍊🚧🍊🚧:", data);
    console.log("cql", cql);
    const works = data?.complexSearch?.works
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
    return formatedWorks(works);
  } catch (error) {
    console.log("EEROR: ", error);

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

const searchIndexes: { [key: string]: string } = {
  title: "term.title",
  language: "phrase.language",
  author: "term.creatorcontributor",
  subject: "term.subject",
  worktype: "worktype",
};

export async function promptToCQL({
  messages,
  parameters,
  say,
}: {
  messages: Message[];
  parameters: any;
  say: Function;
}): Promise<string | null> {
  const newSystemPrompt = `
Ud fra samtalen, skal du lave en CQL-søgning.

Her er de indekser du kan bruge: ${JSON.stringify(allowedIndexes)}

Du kan bruge "AND", "OR", "NOT" mellem indekserne.
Hvis du er i tvivl om nogle af værdierne skal du ikke svare på dem. Du må ikke bare gætte. 

HVIS VÆRDIEN IKKE STÅR I SAMTALEN, MÅ DU IKKE SVARE PÅ DET. DU MÅ IKKE TIFØJE VÆRDIER SOM IKKE ER NÆVNT I SAMTALEN!

Du skal skrive på dansk. Kun på dansk. 

Du returnerer KUN en CQL-streng. Eksempelvis (term.title="harry potter" AND term.creatorcontributor="rowling")

Retunere kun cql-streng. Skriv ikke andet end cq-strengen.


  `;

  const copy = [
    ...messages.filter((entry) => entry.role !== "system"),
    { role: "system", content: newSystemPrompt } as Message,
  ];
  const controller = new AbortController();

  const res = await llmGenerate({
    controller,
    messages: copy,
    parameters,
    // say,
  });
  console.log("\n\n\n\n⏳promptToSearchObject.res", res);
  return res?.replaceAll("</s>", "") || null;
}

async function generate({ messages, parameters, say, close }: GenerateRequest) {
  const shouldPerformSearch = await searchIsRequired({
    messages,
    parameters,
    say,
  });
  if (messages.length === 3) {
    say(
      `\n\n\n\n 🚧OBS. modellen er ikke 100% færdig endnu. Følgende indekser er implementeret: ${Object.values(searchIndexes).join(" , ")}\n\n\n\n \n\n\n\n  `,
    );
  }
  if (shouldPerformSearch) {
    say(`\nAnalyserer..\n`);

    const cql = await promptToCQL({
      messages,
      parameters,
      say,
    });

    say("\nJeg laver denne cql søgning: \n\n" + cql + "\n\n");
    if (cql) {
      const works = await searchByCQL(cql);

      console.log("\n\n 🚨🚨🚨🚨 here are the works BY CQLlll: ", works);

      if (works.length > 0) {
        say("\nSøgning gennemført. Jeg analyserer resultaterne..\n\n");

        await finalAnswer({ messages, parameters, works, say });
        console.log("\n\n", works);
      } else {
        say("\nJeg fandt desværre ikke nogle resultater.");
      }
    } else {
      say("\nKunne ikke lave en søge query fra din prompt.\n");
    }
  } else {
    await llmGenerate({
      messages,
      parameters,
      say,
    });
  }

  close();
}

export default {
  generate,
} as CustomModel;
