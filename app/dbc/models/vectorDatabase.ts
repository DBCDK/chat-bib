import { initializeApollo } from "@/app/client/apolloClient";
import { CustomModel, GenerateRequest, Message } from "../index";
import { llmGenerate } from "../llmClient";
import { gql } from "@apollo/client";
import MaterialCard from "../components/MaterialCard/MaterialCard";
import { searchWorks } from "../clients/vectorDB";

export interface FormatedWork {
  title: string;
  cover: string;
  abstract: string;
  work: string; //workId
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
    
  Svar så kort og præcist som muligt. Giv maksimum 5 anbefalinger. Du må KUN finde anbefalinger fra de bøger som jeg har givet dig.

  For hver bog, SKAL du skrive en sætning der fortæller om bogen. 

    Du skal lave en link til bogen i denne format: https://bibliotek.dk/work/{workId}

    Sæt workId fra de givne bøger istedet for {workId}. Eksempelvis: https://bibliotek.dk/work/work-of:870970-basis:xxxxxxxxx

    Vis en liste med en sætning der fortæller om bogen.
  `,
  });

  // We just pass it through to the LLM backend
  const finalAnswer = await llmGenerate({
    messages: copy,
    parameters,
    say,
  });
  say("\n\n\n\n");

  works.forEach((work) => {
    if (finalAnswer.includes(work.work)) {
      MaterialCard.serialize({ say, workId: work.work });
    }
  });
  say("\n\n\n\n");

  console.log("\n\nfinal answer: ", finalAnswer);
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

function extractQueryFromText(text: string): string | null {
  const start = text.indexOf("#b");
  const end = text.indexOf("#e");

  if (start === -1 || end === -1 || start >= end) {
    return null;
  }

  return text.substring(start + 2, end).trim();
}

async function promptToSearchString({
  messages,
  parameters,
  say,
}: {
  messages: Message[];
  parameters: any;
  say: Function;
}): Promise<string | null> {
  const systemPrompt = `
Ud fra samtalen, skal du lave en søge query. Queryen må maks være 50 tegn lang.

Du svarer ALDRIG selv på spørgsmålet.


Hvis du er i tvivl om nogle af værdierne skal du retunere null. Du må ikke bare gætte. 

Du skal skrive på dansk. Kun på dansk. 

Du returnerer KUN dette format, aldrig andet:
#b din query her #e

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
    // say,
  });
  console.log("\n\n\n\n⏳promptToSearchObject.res", res);

  const query = extractQueryFromText(res);
  console.log("\n\n\n\n⏳promptToSearchObject.searchObject", query);

  //   const validatedSearchObject = validateSearchObject(searchObject);
  //   console.log("\n\n\nalidatedSearchObject.searchObject", validatedSearchObject);
  return query;
}

async function generate({ messages, parameters, say, close }: GenerateRequest) {
  const shouldPerformSearch = await searchIsRequired({
    messages,
    parameters,
    say,
  });

  if (shouldPerformSearch) {
    say(`\nAnalyserer⏳\n`);

    const searchQuery = await promptToSearchString({
      messages,
      parameters,
      say,
    });

    say(
      "\nJeg laver en søgning til vector databasen \n\n" +
        "q: " +
        searchQuery +
        "\n\n",
    );

    if (searchQuery && searchQuery !== "null") {
      console.log("\n\n\n\n\n\n\n\nLaver søgning til vector DB: ", searchQuery);
      const works = await searchWorks(searchQuery);
      console.log("\n\n 🚨🚨🚨🚨 here are the works: ", works);

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
    // say(`\n Der er ikke behov for at lave en søgning \n`);

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
