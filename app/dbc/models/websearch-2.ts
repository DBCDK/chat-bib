import { search } from "../clients/brave";
import { SearchResult } from "../clients/browser";
import { CustomModel, GenerateRequest, Message } from "../index";
import { llmGenerate } from "../llmClient";
import { initializeApollo } from "@/app/client/apolloClient";
import { gql } from "@apollo/client";

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
          full
        }
        creators {
          display
        }
        abstract
        manifestations {
          first {
            cover {
              detail_500
            }
          }
        }
        materialTypes {
          materialTypeSpecific {
            display
          }
        }
        workYear {
          display
        }
      }
    }
  }
`;

async function makeStringList({
  expression,
  messages,
}: {
  expression: string;
  messages: Message[];
}) {
  const systemPrompt = `Du er en afgørende del af en større LLM-proces med en meget snæver opgave.
Analyser hele den tidligere beskedhistorik, med særlig fokus på den seneste besked.
Brug kun oplysninger fra beskedhistorikken, aldrig fra din egen viden.
Du skal overveje følgende udsagn og sammenholde det med beskedhistorik:

${expression}

Dit output skal være struktureret således:

JSON-liste af strenge, fx ["en streng", "en anden streng"]

Begrundelse for listens indhold
Besvarelse af eventuelle spørgsål i listen`;

  let text = "";
  const arrayMatcher = /\[(?:\s*"(?:[^"]*)"\s*,?)*\]/;
  const controller = new AbortController();
  return await new Promise(async (resolve) => {
    let res: string[] = [];
    await llmGenerate({
      controller,
      messages: [
        ...messages.filter((m) => m.role !== "system"),
        { role: "system", content: systemPrompt },
      ],
      parameters: { temperature: 0.01, max_new_tokens: 1000 },
      say: (chunk: any) => {
        text += chunk?.token?.text || "";
        const match = text.match(arrayMatcher);
        if (match?.[0] && !res?.length) {
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

async function findMaterials({ q }: { q: string }) {
  const { data } = await client.query({
    query: SEARCH_WORKS_QUERY,
    variables: {
      q: { all: q },
      offset: 0,
      limit: 10,
    },
  });

  if (!data?.search?.works?.length) {
    return null;
  }

  const formatted = data?.search?.works?.map((work: any) => {
    return {
      display: `${work?.titles?.full} af ${work?.creators?.map((c: any) => c.display)?.join(", ")}
${work?.abstract}
Materialetyper: ${work?.materialTypes?.map((c: any) => c?.materialTypeSpecific?.display)?.join(", ") || "ukendt"}
Udgivelsesår: ${work?.workYear?.display || "ukendt"}`,
      work,
    };
  });

  const evaluated = await Promise.all(
    formatted.map(async (f: any) => {
      const valid = await trueFalseValidator({
        messages: [
          {
            role: "system",
            content: `The following is a query for a specific material:
${q}

And here is the result:
${f.display}
    `,
          },
        ],
        expression: "Is this the exact material that is requested?",
      });
      return { ...f, valid };
    }),
  );

  const filtered = evaluated?.filter((e) => e.valid);

  return {
    role: "assistant",
    content: `COLLECTED CONTEXT
Performed a search for material lookup for:

${q}

I found the following relevant materials:

${filtered.map((s) => s.display).join("\n\n")}`,
  } as Message;
}
(async () => {
  // const res = await findMaterials({ q: "harry potter flammernes pokal bog" });
  // console.log(res);
})();

async function score({
  expression,
  messages,
}: {
  expression: string;
  messages: Message[];
}) {
  const systemPrompt = `
You are a crucial part of a larger LLM flow, with one very narrow job.  
Analyze the entire previous message history, with particular focus on the most recent message.
Only use information from the message history, never from your own knowledge.
You must then consider the following statement, and very accurately determine the score

Statement:
${expression}

The score is between 0 and 9 where 9 is the highest score, and 0 is the lowest score.
0: Terrible result, no match at all
1: Very bad result. Almost nothing matches
3: bad result.
5: OK result, but not all aspects of the statement are matching
8: Great match. Allmost all aspects match perfectly
9: Simply perfect. All aspects match

Always start the output with a score between 0-9, and then give the explanation on a new line.`;
  const controller = new AbortController();
  const copy = [
    ...messages,
    { role: "system", content: systemPrompt } as Message,
  ];
  let res: Number | undefined;

  await llmGenerate({
    messages: copy,
    parameters: { temperature: 0.01, max_new_tokens: 500 },
    controller,
    say: (chunk: any) => {
      if (typeof res !== "undefined") {
        return;
      }
      const n = chunk?.token?.text?.match(/[0-9]/g)?.[0];
      if (n) {
        res = parseInt(n, 10);
        controller.abort();
      }
    },
  });

  return res || 0;
}

async function trueFalseValidator({
  expression,
  messages,
}: {
  expression: string;
  messages: Message[];
}) {
  const systemPrompt = `
You are a crucial part of a larger LLM flow, with one very narrow job.  
Analyze the entire previous message history, with particular focus on the most recent message.
Only use information from the message history, never from your own knowledge.
You must then consider the following statement, and very accurately determine if it is true or false

Statement:
${expression}

Determine if statement above is true. Output either 0 or 1.

1: expression is true
0: expression is false

Always start the output with 0 or 1, and then give the explanation.`;
  const controller = new AbortController();
  const copy = [
    ...messages,
    { role: "system", content: systemPrompt } as Message,
  ];
  let res: Boolean | undefined;

  const answer = await llmGenerate({
    messages: copy,
    parameters: { temperature: 0.01, max_new_tokens: 500 },
    controller,
    say: (chunk: any) => {
      if (typeof res !== "undefined") {
        return;
      }
      if (chunk?.token?.text?.includes("1")) {
        console.log("SET TO 1");
        res = true;
        controller.abort();
      } else if (chunk?.token?.text?.includes("0")) {
        console.log("SET TO 0");
        res = false;
        controller.abort();
      }
    },
  });

  return !!res;
}

async function planner3({ messages }: { messages: Message[] }) {
  const [webSearchRequired, materialSearchIsRequired] = await Promise.all([
    trueFalseValidator({
      expression: `The answer to the users question is in the conversation history`,
      messages,
    }),
    trueFalseValidator({
      expression: `A materialID has tried to be fetch for every`,
      messages,
    }),
  ]);

  return { webSearchRequired: !webSearchRequired, materialSearchIsRequired };
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
Du skal returnere JSON liste (KUN indeholdende strenge). Gerne på dansk

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
async function detectMaterialQueries({
  messages,
  parameters,
}: {
  messages: Message[];
  parameters: any;
}): Promise<string[]> {
  const systemPrompt = `
Nuværende årstal: 2024

Ud fra samtalen, skal du finde ALLE titler og forfattere og lave en JSON liste af titel-forfatter par.
Brug kun tekst du har fundet i samtalehistorik!

Et element i listen er ALTID en streng.
Et element kan være en titel
Et element kan være en forfatter
Et element kan være en titel og forfatter sammensat

Eksempel:

["Det låste rum Elly Griffiths", "Natteløberen", "Et ondt hjerte Linda Castillo"]

  `;
  const copy = [
    ...messages,
    { role: "system", content: systemPrompt } as Message,
  ];
  const controller = new AbortController();
  let text = "";
  const arrayMatcher = /\[(?:\s*"(?:[^"]*)"\s*,?)*\]/;

  console.log("prompt", copy);

  return await new Promise(async (resolve) => {
    let res: string[] = [];
    await llmGenerate({
      controller,
      messages: copy,
      parameters,
      say: (chunk: any) => {
        text += chunk?.token?.text || "";
        console.log(text);
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
async function capturedLLM({
  messages,
  expression,
}: {
  messages: Message[];
  expression: string;
}): Promise<string> {
  const systemPrompt = `Du er en afgørende del af en større LLM-proces med en meget snæver opgave.
  Analyser hele den tidligere beskedhistorik, med særlig fokus på den seneste besked.
  Brug kun oplysninger fra beskedhistorikken, aldrig fra din egen viden.

  Du skal overveje følgende udsagn og sammenholde det med beskedhistorik:
  
  ${expression}
  
  Dit output skal være struktureret således:

  <ANSWER>Kortfattet men præcist svar på det givne udsagn</ANSWER>
  <ANSWER_FOR_END_USER>Svar på slutbruerens spørgsmål</ANSWER_FOR_END_USER>
  <REASON>Begrundelse for svaret</REASON>

  - Begrundelse for din behandling af udsagn
  - Svar på udsagn, hvor du hjælper slutbrugeren med et detaljeret svar`;

  let text = "";
  let isInImportantText = false;
  let importantText = "";
  const arrayMatcher = /\[(?:\s*"(?:[^"]*)"\s*,?)*\]/;
  const controller = new AbortController();
  return await new Promise(async (resolve) => {
    await llmGenerate({
      controller,
      messages: [
        ...messages.filter((m) => m.role !== "system"),
        { role: "system", content: systemPrompt },
      ],
      parameters: { temperature: 0.01, max_new_tokens: 1000 },
      say: (chunk: any) => {
        text += chunk?.token?.text || "";

        if (text.toLocaleUpperCase().includes("<ANSWER>")) {
          isInImportantText = true;
          text = "";
        } else if (text.toLocaleUpperCase().includes("</ANSWER>")) {
          importantText = text.replace("</ANSWER>", "");
          controller.abort();
        }
      },
    });
    resolve(importantText);
  });
}
async function vectorSearch({ q }: { q: string }) {
  const res = await fetch(
    `http://blurb-quest-1-0.mi-prod.svc.cloud.dbc.dk/?q=${encodeURIComponent(q)}&k=20`,
  );

  const json = await res.json();

  return json?.response;
}

async function performWebSearchAction({
  messages,
  parameters,
}: {
  messages: Message[];
  parameters: any;
}) {
  const queries = await detectQuestions({ messages, parameters });
  console.log({ queries });
  let searchResults = [];
  for (let i = 0; i < queries.length; i++) {
    const q = queries[i];
    await new Promise((r) => setTimeout(r, 1200));
    const results = await search(q);
    searchResults.push(results as SearchResult[]);
  }
  let mergedResults = mergeLists(searchResults)?.slice(0, 20) || [];

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
  ).filter((entry) => entry.isValidSource);

  return {
    role: "assistant",
    content: `COLLECTED CONTEXT
Performed a web search for:
${queries.join("\n")}

I found the following web pages containing relvant information:
${validatedSources
  .map((s) => s.content)
  .slice(0, 5)
  .join("\n\n")}`,
  } as Message;
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

  if (
    await trueFalseValidator({
      messages,
      expression:
        "Mangler brugeren at få hjælp til at finde bøger, ebøger, film (fx blurays, dvd), musik eller artikler?",
    })
  ) {
    say("Du leder da vist efter noget biblioteksrelateret\n\n");
    const userIntention = await capturedLLM({
      messages,
      expression:
        "Returnér en streng som forklarer hvad brugerens seneste ønske eller behov er. Kort opsummering, hvor du får alle væsentlige detaljer med max 200 karakterer",
    });
    const keywords = await capturedLLM({
      messages: [
        ...messages,
        {
          role: "assistant",
          content: `Her er brugerens intention:

${userIntention}`,
        },
      ],
      expression:
        "Returnér en streng der kan bruges til en søgning. Du skal inkludere alle aspekter, dog skære alle overflødige ord væk, da det ellers vil give 0 hits. Ligeledes må du gerne opdele ord, for at minimere risiko for 0 hits. Emneord og materialetyper skal være på dansk",
    });

    console.log("");
    console.log("keywords", keywords);
    console.log("");

    console.log("\n\n", "userIntention", userIntention, "\n\n");
    const vectorSearchRes = await vectorSearch({ q: keywords || "" });

    let evaluated = await Promise.all(
      vectorSearchRes?.map(async (entry: any) => {
        const s = await score({
          expression: `How well does this material fit the users' need?\n\n ${entry.llm_text}`,
          messages,
        });

        return { ...entry, llmScore: s };
      }),
    );

    evaluated?.sort((a, b) => b.llmScore - a.llmScore);
    console.log(evaluated);
    evaluated = evaluated?.slice(0, 3);

    await llmGenerate({
      messages: [
        ...messages,
        {
          role: "system",
          content: `Du er en hjælpsom og dansktalende bibliotekarassistent, der ønsker at give brugeren en god oplevelse
med at finde frem til et materiale. Du får vist et resume af brugerens behov, og dernæst en række materialer som passer bedst.

Baseret på chathistorik, er her et resume af brugerens behov:

${userIntention}

Disse er de bedst matchende materialer der er fundet:

${evaluated?.map((r) => r.llm_text).join("\n\n")}

Du skal nu præsentere materialerne for slutbrugeren. Det er vigtigt at du redegør for hvordan materialet passer godt,
men også forklarer, hvor materialet muligvis ikke passer helt så godt.
`,
        },
      ],
      parameters,
      say, // Remove this, if you don't want it to stream directly to client
    });
  } else if (
    await trueFalseValidator({
      messages,
      expression:
        "Is the user just chit-chatting, having no explicetely stated need?",
    })
  ) {
    await llmGenerate({
      messages,
      parameters,
      say, // Remove this, if you don't want it to stream directly to client
    });
  } else {
    await llmGenerate({
      messages: [
        ...messages,
        {
          role: "system",
          content:
            "Giv brugeren en besked, hvor du beklager, at du ikke kan hjælpe, da du er en biblioteksbot",
        },
      ],
      parameters,
      say, // Remove this, if you don't want it to stream directly to client
    });
  }

  close();
}

// async function generate({ messages, parameters, say, close }: GenerateRequest) {
//   if (messages?.[messages?.length - 1]?.role !== "user") {
//     // We just pass it through to the LLM backend
//     await llmGenerate({
//       messages,
//       parameters,
//       say, // Remove this, if you don't want it to stream directly to client
//     });
//     close();

//     return;
//   }

//   let userQuestions;
//   let collectedContext: Message[] = [];
//   if (
//     await trueFalseValidator({
//       messages,
//       expression:
//         'Did the user ask a question that has not been resolved? For instance, "Jeg vil gerne læse en krimi", "Fortæl mig noget om 2. verdenskrig"',
//     })
//   ) {
//     if (!userQuestions) {
//       userQuestions = await makeStringList({
//         messages: messages.filter((m) => m.role !== "assistant"),
//         expression:
//           "Hvad er brugerens seneste spørgsmål? Hvad er brugerens intention?",
//       });
//     }

//     console.log("Question was asked", userQuestions);

//     if (
//       await trueFalseValidator({
//         messages: [
//           {
//             role: "assistant",
//             content: `The users questions:\n${userQuestions} ${collectedContext.length === 0 ? "\n\n No information retrieved" : ""}`,
//           },
//           ...collectedContext,
//         ],
//         expression: "Did we retrieve information to answer the question?",
//       })
//     ) {
//       console.log("We have all the information");
//     } else {
//       console.log("We need to fetch information from the web");
//       const msg = await performWebSearchAction({
//         messages: [
//           {
//             role: "assistant",
//             content: `The users questions:\n${userQuestions} ${collectedContext.length === 0 ? "\n\n No information retrieved" : ""}`,
//           },
//           ...collectedContext,
//         ],
//         parameters,
//       });
//       console.log(msg);
//       collectedContext.push(msg);
//     }

//     if (
//       await trueFalseValidator({
//         messages: [
//           {
//             role: "assistant",
//             content: `The users questions:\n${userQuestions} ${collectedContext.length === 0 ? "\n\n No information retrieved" : ""}`,
//           },
//           ...collectedContext,
//         ],
//         expression:
//           "Does the message history contain references to specific titles or authors?",
//       })
//     ) {
//       console.log("We should look up in FBI-API");
//       const materialQueries =
//         (await detectMaterialQueries({
//           messages: [
//             {
//               role: "assistant",
//               content: `The users questions:\n${userQuestions} ${collectedContext.length === 0 ? "\n\n No information retrieved" : ""}`,
//             },
//             ...collectedContext,
//           ],
//           parameters,
//         })) || [];
//       const fbiRes = await Promise.all(
//         materialQueries.slice(0, 5).map((q) => {
//           return findMaterials({ q });
//         }),
//       );

//       fbiRes
//         .filter((r) => !!r)
//         .forEach((m) => {
//           collectedContext.push(m as Message);
//         });
//       console.log("queries", materialQueries, fbiRes);
//     }
//   } else {
//     console.log("Casual conversation");
//     await llmGenerate({
//       messages,
//       parameters,
//       say, // Remove this, if you don't want it to stream directly to client
//     });
//     close();
//     return;
//   }

//   // say("Hej der...\n\n");
//   await llmGenerate({
//     messages: [
//       ...messages,
//       {
//         role: "system",
//         content: `Brug kun den indsamlede context til at svare. Husk at svare på velformuleret dansk:\n\n${JSON.stringify(collectedContext, null, 2)}`,
//       },
//     ],
//     parameters,
//     say, // Remove this, if you don't want it to stream directly to client
//   });
//   close();
// }

// async function generate({ messages, parameters, say, close }: GenerateRequest) {
//   if (messages?.[messages?.length - 1]?.role !== "user") {
//     // We just pass it through to the LLM backend
//     await llmGenerate({
//       messages,
//       parameters,
//       say, // Remove this, if you don't want it to stream directly to client
//     });
//     close();

//     return;
//   }

//   // messages = messages.filter((entry) => entry.role !== "system");
//   // messages = [
//   //   {
//   //     role: "system",
//   //     content: `
//   // Du hedder Chatbib, og er en dansk sprogmodel udviklet til at hjælpe unge studerende.
//   // Du bygger på Mixtral modellen. Du er en hjælpsom og venlig chatbot, der alitd svarer på dansk.
//   // Du prøver alitd at svare sandfærdigt og venligt.`,
//   //   },
//   //   ...messages,
//   // ];

//   // messages = [
//   //   {
//   //     role: "user",
//   //     content: "Jeg er interesseret i en ny film. Den skal være uhyggelig",
//   //   },
//   // ];

//   let allMessages = [...messages];
//   let done = false;
//   while (!done) {
//     const { webSearchRequired } = await planner3({ messages: allMessages });
//     console.log("");
//     console.log("PLANNING", { webSearchRequired });
//     if (webSearchRequired) {
//       const searchMessage = await performWebSearchAction({
//         messages: allMessages,
//         parameters,
//       });
//       allMessages.push(searchMessage);
//     } else {
//       done = true;
//     }
//   }

//   // say("Hej der...\n\n");
//   await llmGenerate({
//     messages,
//     parameters,
//     say, // Remove this, if you don't want it to stream directly to client
//   });
//   close();
// }

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

export default {
  generate,
} as CustomModel;
