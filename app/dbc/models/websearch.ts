import { search } from "../clients/brave";
import { SearchResult } from "../clients/browser";
import { CustomModel, GenerateRequest, Message, MODEL_NAMES } from "../index";
import PluginStatus from "../components/PluginStatus/PluginStatus";

import { llmGenerate } from "../llmClient";
import { ModelDescription } from "./modelsDescriptions";
const id = MODEL_NAMES.DBC_WEB_SEARCH;

async function finalAnswer({
  messages,
  parameters,
  validatedSources,
  say,
}: {
  messages: Message[];
  validatedSources: SearchResult[];
  parameters: any;
  say: Function;
}) {
  const copy = [...messages];
  copy.push({
    role: "system",
    content: `Dette er et uddrag fra et søgeresultat, som du SKAL bruge til at besvare spørgsmål.
  
  ${JSON.stringify(validatedSources?.slice(0, 5))}
  
  Du må IKKE gætte på hvad der står i den fulde artikel. Du må KUN bruge det indehold står i "content".
  
  Svar så kort og præcist som muligt.
  `,
  });

  // We just pass it through to the LLM backend
  await llmGenerate({
    messages: copy,
    parameters,
    say, // Remove this, if you don't want it to stream directly to client
  });

  say("\n\nKilder:\n");
  say(
    Object.values(validatedSources?.slice(0, 5))
      .map((s) => " * " + s.href + "\n    " + s.content?.slice(0, 100) + "...")
      .join("\n"),
  );
}

async function noAnswer({
  messages,
  parameters,
  say,
}: {
  messages: Message[];
  parameters: any;
  say: Function;
}) {
  const systemPrompt = `
Du skal give en kort beklagelse til brugeren, at du ikke kan svare på forespørgslen.
Lad som om du har ledt grundigt og længe efter et svar i alle dine notater. 
  `;
  const copy = [
    ...messages,
    { role: "system", content: systemPrompt } as Message,
  ];

  await llmGenerate({
    messages: copy,
    parameters,
    say,
  });
}

async function validateSource({
  questions,
  searchResult,
  parameters,
}: {
  questions: string[];
  searchResult: SearchResult;
  parameters: any;
}): Promise<Boolean> {
  const systemPrompt = `
Du skal NØJE undersøge denne tekst ord for ord:

${searchResult.content}

Nu skal du undersøge om den besvarer mindst ét af disse spørgsmål:

${questions.join("\n")}

Hvis der ikke står et HELT præcist svar på spørgsmålet, så skal containsAnswer være 0.
Ellers 1. Du må IKKE bruge din egen viden som kilde.

Svar KUN med denne JSON struktur
{"containsAnswer": 1|0}

  `;
  const copy = [{ role: "system", content: systemPrompt } as Message];
  const controller = new AbortController();

  const res = await new Promise(async (resolve) => {
    let text = "";
    let containsAnswer = false;
    await llmGenerate({
      controller,
      messages: copy,
      parameters,
      say: (chunk: any) => {
        text += chunk?.token?.text || "";
        const noSpaces = text.replace(/\s/g, "");

        if (noSpaces.includes('"containsAnswer":1')) {
          containsAnswer = true;
          controller.abort();
        } else if (noSpaces.includes('"containsAnswer":0')) {
          controller.abort();
        }
      },
    });
    resolve(containsAnswer);
  });

  return res as Boolean;
}

async function searchIsRequired({
  messages,
  parameters,
}: {
  messages: Message[];
  parameters: any;
  say: Function;
}): Promise<Boolean> {
  const systemPrompt = `
Ud fra samtalen, skal du finde ud af om der er behov for at lave en Google søgning
Der skal IKKE laves en søgning, hvis spørgsmål handler om ChatBib, eller det bare er smalltalk.
ALLE andre spørgsmål kræver en søgning.
Du svarer ALDRIG selv på spørgsmålet.
Du returnerer 1, hvis der er behov for søgning
Du returnerer 0, hvis der IKKE er behov for søgning.
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

async function detectQuestions({
  messages,
  parameters,
}: {
  messages: Message[];
  parameters: any;
}): Promise<string[]> {
  const systemPrompt = `
Nuværende årstal: 2024

Ud fra samtalen, skal du nedbryde brugerens forespørgsel til én eller maks tre meget simple Google søgninger.
Hver søgning SKAL KUN svare på ét spørgsmål. UNDGÅ at lave søgninger der svarer på samme spørgsmål.
Du skal returnere JSON liste (KUN indeholdende strenge).

Eksempel input:

Hvad er forskellen i længde på den kinesiske og berlinmuren?

Eksempel output

["kinesiske mur længde", "berlinmuren længde"]

  `;
  const copy = [
    ...messages,
    { role: "system", content: systemPrompt } as Message,
  ];
  const controller = new AbortController();
  let text = "";
  // Justér regex til at matche array uden JSON.parse
  const arrayMatcher = /\[(.*)\]/s; // Matcher alt inden i firkantede parenteser, inklusive nye linjer

  return await new Promise(async (resolve) => {
    let res: string[] = [];
    await llmGenerate({
      controller,
      messages: copy,
      parameters,
      say: (chunk: any) => {
        text += chunk?.token?.text || "";

        const match = text.match(arrayMatcher);
        if (match?.[1]) {
          try {
            let possibleArray = match[1].trim();

            // Splitter på strenge med eller uden komma eller newline som separator
            res = possibleArray
              .split(/"\s*(?:,|\n)\s*"/) // Splitter på kommaer eller linjeskift, omgivet af anførselstegn
              .map((item) => item.replace(/^"|"$/g, "").trim()) // Fjerner anførselstegn og trimmer
              .filter((item) => item.length > 0); // Filtrerer tomme elementer

            controller.abort();
          } catch (e) {
            console.error("Error processing text:", e);
          }
        }
      },
    });
    resolve(res);
  });
}
async function generate({ messages, parameters, say, close }: GenerateRequest) {
  if (messages?.[messages?.length - 1]?.role !== "user") {
    // We just pass it through to the LLM backend
    await llmGenerate({
      messages,
      parameters,
      say, // Remove this, if you don't want it to stream directly to client
    });
    close();

    return;
  }
  messages = messages.filter((entry) => entry.role !== "system");
  messages = [
    {
      role: "system",
      content: `
  Du hedder Chatbib, og er en dansk sprogmodel udviklet til at hjælpe unge studerende.
  Du bygger på Mixtral modellen. Du er en hjælpsom og venlig chatbot, der alitd svarer på dansk.
  Du prøver alitd at svare sandfærdigt og venligt.`,
    },
    ...messages,
  ];
  // say("Undersøger forespørgsel...\n\n");
  PluginStatus.serialize({
    say,
    pluginName: id,
    description: `Undersøger forespørgsel...`,
  });
  const performSearch = await searchIsRequired({
    messages,
    parameters,
    say,
  });

  let queries: string[] = [];
  if (performSearch) {
    // say("Jeg laver en websøgning...\n\n");

    PluginStatus.serialize({
      say,
      pluginName: id,
      description: `Laver søgestrenge...`,
    });

    queries = await detectQuestions({ messages, parameters });

    if (queries.length === 0) {
      say(
        "Sikke et antiklimaks, jeg kunne ikke finde ud af at lave søgninger!",
      );
    } else {
      // say(
      //   `Påtænker at lave ${queries.length} søgning${queries.length === 1 ? "" : "er"}:\n\n`,
      // );
    }
  }
  // say("Søger\n\n");
  // const site = "site:faktalink.dk "
  const site = "";

  const searchResults: SearchResult[][] = [];
  for (let i = 0; i < queries.length; i++) {
    const q = queries[i];

    await new Promise((r) => setTimeout(r, 50));
    PluginStatus.serialize({
      say,
      pluginName: id,
      description: `Søger på: ${q}...`,
    });
    // say(` * ${q}...`);

    const results = await search(site + q);
    // say(` Hits: ${results.length}\n`);

    // PluginStatus.serialize({
    //   say,
    //   pluginName: id,
    //   description:`Hits: ${results.length}\n`,
    // });
    searchResults.push(results as SearchResult[]);
  }

  //say("\n\n");
  let mergedResults = mergeLists(searchResults)?.slice(0, 20) || [];

  // say(
  //   `Validerer ${mergedResults.length} søgeresultat${mergedResults.length === 1 ? "" : "er"} \n\n`,
  // );

  const validatedSources = (
    await Promise.all(
      mergedResults.map(async (entry: any) => {
        const isValidSource = await validateSource({
          questions: queries,
          searchResult: entry,
          parameters,
        });
        return { ...entry, isValidSource };
      }),
    )
  )
    .filter((entry) => entry.isValidSource)
    .map((entry) => ({
      ...entry,
      content: entry.content.replace(/<\/?strong>/gm, ""),
    }));

  const uniqSources: any = {};
  validatedSources?.forEach((s) => (uniqSources[s.href] = s));
  PluginStatus.serialize({
    say,
    pluginName: id,
    description: `Færdig.`,
  });
  if (validatedSources?.length > 0) {
    await finalAnswer({ messages, parameters, say, validatedSources });
  } else {
    await noAnswer({
      messages,
      parameters,
      say, // Remove this, if you don't want it to stream directly to client
    });
  }

  close();
}

function mergeLists(lists: SearchResult[][]): SearchResult[] {
  let result: SearchResult[] = [];
  let maxLength = Math.max(...lists.map((list) => list.length));

  for (let i = 0; i < maxLength; i++) {
    lists.forEach((list) => {
      if (i < list.length) {
        result.push(list[i]);
      }
    });
  }

  return result;
}

export const modelDescription: ModelDescription = {
  name: MODEL_NAMES.DBC_WEB_SEARCH,
  description:
    "En model der slår ting op på nettet og henter de nyeste fakta (datoer, begivenheder, nyheder, priser osv.). " +
    "VÆLG ALTID DENNE MODEL når brugeren spørger om noget aktuelt eller tidsafhængigt. Vejret, aktulle begivenheder, hvornår noget finderssted osv. ",
  // "En model der automatisk udfører websøgninger, når et spørgsmål kræver aktuelle eller verificerbare oplysninger. Bruges til forespørgsler som fx 'Hvordan er vejret i København?', 'Hvad sker der i verden lige nu?' eller andre spørgsmål, hvor svaret afhænger af nyeste data.",
};

export default {
  generate,
} as CustomModel;
