//make simple search
//make complex search
//make vector db search
// combine results and return best match

import { searchWorks as searchVectorWorks } from "../clients/vectorDB";
import MaterialCard from "../components/MaterialCard/MaterialCard";
import PluginStatus from "../components/PluginStatus/PluginStatus";
import { CustomModel, GenerateRequest, Message, MODEL_NAMES } from "../index";
import { llmGenerate } from "../llmClient";
import { promptToCQL, searchByCQL } from "./complexSearch";
import { ModelDescription } from "./modelsDescriptions";
import {
  promptToSearchObject,
  searchWorks as searchSimpleSearch,
} from "./simpleSearch";
import { FormatedWork, promptToSearchString } from "./vectorDatabase";
const id = MODEL_NAMES.DBC_GENERAL_MODEL;
async function complexSearchResults({
  messages,
  parameters,
  say,
  close,
}: GenerateRequest) {
  // say("\n\n⏳Laver en cql søgning..\n\n");

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
  //say("🎢 🚨Laver en simple search søgning..\n\n");
  //make sure that gramma errors are corrected.
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
  const systemPrompt2 = `Disse er nogle værker, som du SKAL bruge til at besvare spørgsmål. Du må kun bruge disse værker. 
  
  værker:  ${JSON.stringify(works)}
     
   Svar så kort og præcist som muligt. Giv maksimum 5 anbefalinger. Du må KUN finde anbefalinger fra de værker som jeg har givet dig.
 
   For hver bog, SKAL du kun skrive titel og workId.
   `;
  //  Listen skal være i dette format Værker: workId1, workId2, workId3, workId4, workId5
  //  I slutning af din besked skal du retunere en liste med værk id'er sepereret med komma. Du må ikke retunere andet info om værkerne.

  const prompt2 = `Disse er nogle værker, som du SKAL bruge til at besvare spørgsmål. Du må kun bruge disse værker. 
  
 værker:  ${JSON.stringify(works)}
    
  Svar så kort og præcist som muligt. Giv maksimum 5 anbefalinger. Du må KUN finde anbefalinger fra de værker som jeg har givet dig.

  DU MÅ IKKE SKRIVE ANDET INFO OM VÆRKERNE. IKKE titel, forfatter eller andet info. KUN VÆRK ID'ER.
  Skriv værkerne i denne format: #værkId1, #værkId2, #værkId3, #værkId4, #værkId5
  `;
  const copy = [...messages];
  copy.push({
    role: "system",
    content: systemPrompt2,
  });
  // PluginStatus.serialize({
  //   say,
  //   pluginName: id,
  //   description: `Færdig.`,
  // });
  // We just pass it through to the LLM backend
  const finalAnswer = await llmGenerate({
    messages: copy,
    parameters,
    say: (message: string) => {
      // console.log("\n\n in SAY FINAL ANSWER: ", message);

      //TODO: check if the message is a workId, if so send materialCard with that workId
      say(message);
    },
  });

  say("\n\n\n\n");
  console.log("\n\nfinal answer works!!: ", works, "\n\n\n works");
  works.forEach((work) => {
    if (finalAnswer.includes(work.workId)) {
      MaterialCard.serialize({ say, workId: work.workId });
    }
  });
}
async function generate({ messages, parameters, say, close }: GenerateRequest) {
  // const vectorWorks = await vectorDBResults({
  //   messages,
  //   parameters,
  //   say,
  //   close,
  // });

  // say(`Jeg fandt ${vectorWorks.length} værker i vector databasen\n\n`);
  //  console.log("\n\n\n\nvectorWorks", vectorWorks);
  //say("\nSøger efter værker... ");

  PluginStatus.serialize({
    say,
    pluginName: id,
    description: `Søger efter værker...`,
  });
  const complexSearchWorks = await complexSearchResults({
    messages,
    parameters,
    say,
    close,
  });

  PluginStatus.serialize({
    say,
    pluginName: id,
    description: `Første søgning foretaget... `,
  });
  //say("\nFørste søgning foretaget... ");
  //say(`Jeg fandt ${complexSearchWorks.length} værker i complex search \n\n`);
  console.log(
    `Jeg fandt ${complexSearchWorks.length} værker i complex search \n\n`,
  );
  // console.log("\n\n\n\ncomplexSearchWorks", complexSearchWorks);

  const simpleSearchWorks = await simpleSearchResults({
    messages,
    parameters,
    say,
    close,
  });
  //say("\nAnden søgning foretaget... ");
  PluginStatus.serialize({
    say,
    pluginName: id,
    description: `Anden søgning foretaget... `,
  });
  //  say(`Jeg fandt ${simpleSearchWorks.length} værker i simple search \n\n`);
  console.log(
    `Jeg fandt ${simpleSearchWorks.length} værker i simple search \n\n`,
  );

  // console.log("\n\n\n\nimpleSearchWorks", simpleSearchWorks);
  //filter away same results
  const works = [...complexSearchWorks, ...simpleSearchWorks].filter(
    (work, index, self) =>
      index === self.findIndex((w) => w.workId === work.workId),
  );

  //const works = [...vectorWorks, ...complexSearchWorks, ...simpleSearchWorks];
  //say(`Jeg fandt i alt ${works.length} værker\n\n`);

  if (works.length === 0) {
    say("Jeg fandt desværre ingen værker. Prøv at stille et andet spørgsmål");
  } else {
    // say("\nAnalyserer resultaterne... \n");
    PluginStatus.serialize({
      say,
      pluginName: id,
      description: `Analyserer resultaterne... `,
    });
    await finalAnswer({ messages, parameters, works, say });
  }

  // We just pass it through to the LLM backend
  //   await llmGenerate({
  //     messages,
  //     parameters,
  //     say, // Remove this, if you don't want it to stream directly to client
  //   });

  close();
}

export const modelDescription: ModelDescription = {
  name: MODEL_NAMES.DBC_MULTI_SEARCH,
  description:
    "En model til at udføre enkle søgninger på bøger baseret på brugerinput. Brug denne model hvis der skal findes eller anbefales en bog. Prioritere denne model hvis der skal findes anbefalinger til bøger, film, artikler og lign..",
};

export default {
  generate,
} as CustomModel;
