import { duckDuckGoSearch, SearchResult } from "../browser";
import { CustomModel, GenerateRequest, Message } from "../index";
import { llmGenerate } from "../llmClient";

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
      .map((s) => " * " + s.href + "\n    " + s.content)
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
Du skal returnere JSON liste (KUN indeholdende strenge). Lav søgningerne på både dansk og engelsk.

Eksempel input:

Hvad er forskellen i længde på den kinesiske og berlinmuren?

Eksempel output

["kinesiske mur længde", "chinese wall length", "berlinmuren længde", "berlin wall length"]

  `;
  const copy = [
    ...messages,
    { role: "system", content: systemPrompt } as Message,
  ];
  const controller = new AbortController();
  let text = "";
  const arrayMatcher = /\[(?:\s*"(?:[^"]*)"\s*,?)*\]/;

  return await new Promise(async (resolve) => {
    let res: string[] = [];
    await llmGenerate({
      controller,
      messages: copy,
      parameters,
      say: (chunk: any) => {
        text += chunk?.token?.text || "";
        const match = text.match(arrayMatcher);
        if (match?.[0]) {
          try {
            res = JSON.parse(match?.[0]);
            controller.abort();
          } catch (e) {}
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
  say("Undersøger forespørgsel...\n\n");
  const performSearch = await searchIsRequired({
    messages,
    parameters,
    say,
  });

  let queries: string[] = [];
  if (performSearch) {
    say("Søgning påkrævet\n\n");
    queries = await detectQuestions({ messages, parameters });
    if (queries.length === 0) {
      say(
        "Sikke et antiklimaks, jeg kunne ikke finde ud af at lave søgninger!",
      );
    } else {
      say(
        `Påtænker at lave ${queries.length} søgning${queries.length === 1 ? "" : "er"}:\n\n`,
      );
    }
  }
  // say("Søger\n\n");
  // const site = "site:faktalink.dk "
  const site = "";

  const searchResults: SearchResult[][] = [];
  for (let i = 0; i < queries.length; i++) {
    const q = queries[i];

    await new Promise((r) => setTimeout(r, 2000));
    say(` * ${q}...`);

    const results = await duckDuckGoSearch(site + q);
    if (results === "TIMEOUT") {
      say(` TIMEOUT\n`);
    } else {
      say(` Hits: ${results.length}\n`);
      searchResults.push(results as SearchResult[]);
    }
  }

  say("\n\n");

  let all: any = [];
  searchResults.forEach((results) => {
    all = [...all, ...results.slice(0, 3)];
  });

  const validatedSources = (
    await Promise.all(
      all.map(async (entry: any) => {
        const isValidSource = await validateSource({
          questions: queries,
          searchResult: entry,
          parameters,
        });
        return { ...entry, isValidSource };
      }),
    )
  ).filter((entry) => entry.isValidSource);

  const uniqSources: any = {};
  validatedSources?.forEach((s) => (uniqSources[s.href] = s));

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

export default {
  generate,
} as CustomModel;
