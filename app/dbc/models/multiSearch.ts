//make simple search
//make complex search
//make vector db search
// combine results and return best match

import { searchWorks as searchVectorWorks } from "../clients/vectorDB";
import MaterialCard from "../components/MaterialCard/MaterialCard";
import { CustomModel, GenerateRequest, Message, MODEL_NAMES } from "../index";
import { llmGenerate } from "../llmClient";
import { promptToCQL, searchByCQL } from "./complexSearch";
import { ModelDescription } from "./modelsDescriptions";
import {
  promptToSearchObject,
  searchWorks as searchSimpleSearch,
} from "./simpleSearch";
import { FormatedWork, promptToSearchString } from "./vectorDatabase";

async function complexSearchResults({
  messages,
  parameters,
  say,
  close,
}: GenerateRequest) {
  say("⏳Laver en cql søgning..\n\n");

  try {
    const cql = await promptToCQL({
      messages,
      parameters,
      say,
    });
    if (!cql) {
      throw new Error("Could not create cql query from prompt");
    }

    // say("\nLaver søgning med følgende cql: " + cql + "\n\n");

    console.log(
      "\n\n\nLaver complex søgning med følgende cql: " + cql + "\n\n",
    );
    return await searchByCQL(cql);
  } catch (error) {
    return [];
  }
}

async function simpleSearchResults({
  messages,
  parameters,
  say,
  close,
}: GenerateRequest) {
  say("🎢 🚨Laver en simple search søgning..\n\n");

  const searchObject = await promptToSearchObject({
    messages,
    parameters,
    say,
  });

  const searchQuery = {
    q: {
      ...searchObject.query,
    },
    filters: { ...searchObject.filters },
  };
  //   say(
  //     "\nLaver søgning med følgende query: " +
  //       JSON.stringify(searchQuery) +
  //       "\n\n",
  //   );
  console.log(
    "\nLaver simple search søgning med følgende query: " +
      JSON.stringify(searchQuery) +
      "\n\n",
  );

  const works = await searchSimpleSearch(searchQuery);

  return works;
}

async function vectorDBResults({
  messages,
  parameters,
  say,
  close,
}: GenerateRequest): Promise<FormatedWork[]> {
  say("↗🏹↗️⤵Laver vector db søgning..\n\n");
  try {
    const searchQuery = await promptToSearchString({
      messages,
      parameters,
      say,
    });
    // say("\nVector søgning  q: " + searchQuery + "\n\n");
    console.log("\nVector søgning  q: " + searchQuery + "\n\n");

    if (searchQuery && searchQuery !== "null") {
      console.log("\n\n\n\n\n\n\n\nLaver søgning til vector DB: ", searchQuery);

      const works = await searchVectorWorks(searchQuery);
      return works;
    } else {
      say("Ingen søgning til vector db");
      throw new Error("Could not create search query from prompt");
    }
  } catch (error) {
    return [];
  }
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
  const systemPrompt = `Disse er nogle værker, som du SKAL bruge til at besvare spørgsmål. Du må kun bruge disse værker. 
  
 værker:  ${JSON.stringify(works)}
    
  Svar så kort og præcist som muligt. Giv maksimum 5 anbefalinger. Du må KUN finde anbefalinger fra de værker som jeg har givet dig.

  For hver bog, SKAL du skrive en sætning der fortæller om bogen. 

    Du skal lave en link til bogen i denne format: https://bibliotek.dk/work/{workId}

    Sæt workId fra de givne værker istedet for {workId}. Eksempelvis: https://bibliotek.dk/work/work-of:870970-basis:xxxxxxxxx

    Vis en liste med en sætning der fortæller om bogen.
  `;
  const copy = [...messages];
  copy.push({
    role: "system",
    content: systemPrompt,
    //     content: `Disse er nogle bøger, som du SKAL bruge til at besvare spørgsmål. Du må kun bruge disse bøger.

    //  bøger:  ${JSON.stringify(works)}

    //   Svar så kort og præcist som muligt. Giv mindst 5 anbefalinger. Du må KUN finde anbefalinger fra de bøger som jeg har givet dig.

    //   For hver bog, SKAL du skrive en sætning der fortæller om bogen.

    //     Du skal lave en link til bogen i denne format: https://bibliotek.dk/work/{workId}

    //     Sæt workId fra de givne bøger istedet for {workId}. Eksempelvis: https://bibliotek.dk/work/work-of:870970-basis:xxxxxxxxx

    //     Vis en liste med en sætning der fortæller om bogen, link til bibliotek.dk samt titlen på bogen.
    //   `,
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
async function generate({ messages, parameters, say, close }: GenerateRequest) {
  const vectorWorks = await vectorDBResults({
    messages,
    parameters,
    say,
    close,
  });

  say(`Jeg fandt ${vectorWorks.length} værker i vector databasen\n\n`);
  //  console.log("\n\n\n\nvectorWorks", vectorWorks);

  const complexSearchWorks = await complexSearchResults({
    messages,
    parameters,
    say,
    close,
  });
  say(`Jeg fandt ${complexSearchWorks.length} værker i complex search \n\n`);
  // console.log("\n\n\n\ncomplexSearchWorks", complexSearchWorks);

  const simpleSearchWorks = await simpleSearchResults({
    messages,
    parameters,
    say,
    close,
  });

  say(`Jeg fandt ${simpleSearchWorks.length} værker i complex search \n\n`);
  // console.log("\n\n\n\nimpleSearchWorks", simpleSearchWorks);

  const works = [...vectorWorks, ...complexSearchWorks, ...simpleSearchWorks];
  say(`Jeg fandt i alt ${works.length} værker\n\n`);
  await finalAnswer({ messages, parameters, works, say });

  // We just pass it through to the LLM backend
  //   await llmGenerate({
  //     messages,
  //     parameters,
  //     say, // Remove this, if you don't want it to stream directly to client
  //   });

  close();
}

export const modelDescription: ModelDescription = {
  name: MODEL_NAMES.DBC_BASE,
  description:
    "General model with no specific purpose. Just passes the input through to the LLM backend.",
};

export default {
  generate,
} as CustomModel;
