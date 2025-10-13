//make simple search
//make complex search
//make vector db search
// combine results and return best match

import { searchWorks as searchVectorWorks } from "../clients/vectorDB";
import Carousel from "../components/Carousel/Index";
import MaterialCard from "../components/MaterialCard/MaterialCard";
import PluginStatus from "../components/PluginStatus/PluginStatus";
import { CustomModel, GenerateRequest, Message, MODEL_NAMES } from "../index";
import { llmGenerate } from "../llmClient";
import { promptToCQL, searchByCQL } from "./complexSearch";
import { ModelDescription } from "./modelsDescriptions";
import {
  promptToSearchObjectViaEndpoint,
  searchWorks as searchSimpleSearch,
} from "./simpleSearch";
import { FormatedWork, promptToSearchString } from "./vectorDatabase";
const workDefinition =
  "Et værk er en bog, en film, en artikel, musik, spil eller andet material som kan lånes på biblioteket.";

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

    PluginStatus.serialize({
      say,
      pluginName: id,
      description: `Søger på ${cql}`,
    });

    return await searchByCQL(cql, 0, 50);
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
  const searchObject = await promptToSearchObjectViaEndpoint({
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

  PluginStatus.serialize({
    say,
    pluginName: id,
    description: `Søger på ${JSON.stringify(searchQuery)}`,
  });
  const works = await searchSimpleSearch(searchQuery, 0, 50);

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

    if (searchQuery && searchQuery !== "null") {
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
  const systemPrompt2 = `Disse er nogle værker, som du SKAL bruge til at besvare spørgsmål. Du må kun bruge disse værker. 
  
  værker:  ${JSON.stringify(works.slice(0, 20))}
     
   Svar så kort og præcist som muligt. Giv maksimum 5 anbefalinger. Du må KUN finde anbefalinger fra de værker som jeg har givet dig.
 
   For hver bog, SKAL du kun skrive titel og workId.
   Du må kun svare på dansk.
   `;
  //  Listen skal være i dette format Værker: workId1, workId2, workId3, workId4, workId5
  //  I slutning af din besked skal du retunere en liste med værk id'er sepereret med komma. Du må ikke retunere andet info om værkerne.

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
    say,
  });

  const carousel: string[] = [];
  works.forEach((work) => {
    if (finalAnswer.includes(work.workId)) {
      //MaterialCard.serialize({ say, workId: work.workId });
      carousel.push(work.workId);
    }
  });
  Carousel.serialize({ say: say, workIds: carousel });
}
async function generate({
  messages,
  parameters,
  say,
  close,
  useContextForSearch = true,
}: GenerateRequest) {
  // const vectorWorks = await vectorDBResults({
  //   messages,
  //   parameters,
  //   say,
  //   close,
  // });

  PluginStatus.serialize({
    say,
    pluginName: id,
    description: useContextForSearch
      ? "Bruger hele beskedhistorik til at danne søgninger"
      : "Bruger seneste besked til at danne søgninger",
  });

  const messagesForSearch = useContextForSearch
    ? messages
    : [messages[messages.length - 1]];

  const simpleSearchPromise = simpleSearchResults({
    messages: messagesForSearch,
    parameters,
    say,
    close,
  });
  const complexSearchPromise = complexSearchResults({
    messages: messagesForSearch,
    parameters,
    say,
    close,
  });

  const [simpleSearchWorks, complexSearchWorks] = await Promise.all([
    simpleSearchPromise,
    complexSearchPromise,
  ]);

  PluginStatus.serialize({
    say,
    pluginName: id,
    description: `To søgninger foretaget... `,
  });
  // PluginStatus.serialize({
  //   say,
  //   pluginName: id,
  //   description: `Anden søgning foretaget... `,
  // });
  const works = [...complexSearchWorks, ...simpleSearchWorks].filter(
    (work, index, self) =>
      index === self.findIndex((w) => w.workId === work.workId),
  );

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
  PluginStatus.serialize({
    say,
    pluginName: id,
    description: `Fuldført.`,
  });

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
  description: `${workDefinition} En model til at udføre enkle søgninger på værker baseret på brugerinput. Brug denne model hvis der skal findes eller anbefales et værk. Prioritér kun denne model hvis der skal findes anbefalinger eller foretages en søgning på værker. Brug denne model KUN hvis der er behov for at finde et værk. Hvis spørgsmålet ikke er relateret til bøger, skal du ikke bruge denne model.`,
};

export default {
  generate,
} as CustomModel;

// const systemPrompt = `Disse er nogle værker, som du SKAL bruge til at besvare spørgsmål. Du må kun bruge disse værker.

//   værker:  ${JSON.stringify(works)}

//    Svar så kort og præcist som muligt. Giv maksimum 5 anbefalinger. Du må KUN finde anbefalinger fra de værker som jeg har givet dig.

//    For hver bog, SKAL du skrive en sætning der fortæller om bogen.

//      Du skal lave en link til bogen i denne format: https://bibliotek.dk/work/{workId}

//      Sæt workId fra de givne værker istedet for {workId}. Eksempelvis: https://bibliotek.dk/work/work-of:870970-basis:xxxxxxxxx

//      Vis en liste med en sætning der fortæller om bogen.
//    `;
//   const prompt2 = `Disse er nogle værker, som du SKAL bruge til at besvare spørgsmål. Du må kun bruge disse værker.

//  værker:  ${JSON.stringify(works)}

//   Svar så kort og præcist som muligt. Giv maksimum 5 anbefalinger. Du må KUN finde anbefalinger fra de værker som jeg har givet dig.

//   DU MÅ IKKE SKRIVE ANDET INFO OM VÆRKERNE. IKKE titel, forfatter eller andet info. KUN VÆRK ID'ER.
//   Skriv værkerne i denne format: #værkId1, #værkId2, #værkId3, #værkId4, #værkId5
//   `;
