import models from "@/app/dbc/models/models";
import { CustomModel, GenerateRequest, Message, MODEL_NAMES } from "../index";
import { llmGenerate } from "../llmClient";
import { modelsDescriptions } from "./modelsDescriptions";
import PluginStatus from "../components/PluginStatus/PluginStatus";
const id = MODEL_NAMES.DBC_GENERAL_MODEL;

async function getModelByPrompt({
  messages,
  parameters,
  say,
}: GenerateRequest): Promise<{ generate: Function }> {
  const systemPromptOLD = `
    Ud fra samtalen, skal du finde ud af om hvilken model der skal bruges. 
    
    Du returnerer KUN dette json format, aldrig andet:
    {"modelName": navn på model}


        
    Du skal vælge en model fra følgende: ${JSON.stringify(modelsDescriptions)}.
    Hvis du er i tvivl om hvilken model der skal bruges, skal du bruge ${MODEL_NAMES.DBC_BASE}. 

    HUSK at du skal returnere et modelnavn i dette format: 
     {"modelName": navn på model}

     Du må aldrig skrive andet info end det der står i json formatet. Du må IKKE skriv noget før eller efter json formatet.
     Hvis brugerens spørgsmål er uklar, må du godt stille uddybende spørgsmål til brugeren. Maks 1 uddybende spørgsmål. Hvis din sidste besked var en uddybende spørgsmål, må du ikke stille et nyt uddybende spørgsmål.
    
      `;

  //TODO: remove VALGKRITERIER (kort)

  const systemPrompt = `
Du er en router. Vælg præcis én model.

REGLER
- Du returnerer KUN dette json format, aldrig andet: {"modelName": navn på model}
- MODEL_NAME skal være én af: ${JSON.stringify(modelsDescriptions)}
- Hvis du er i tvivl om hvilken model der skal bruges, skal du bruge ${MODEL_NAMES.DBC_BASE}. 
- Må IKKE tilføje tekst før/efter JSON. Ingen markdown.

VALGKRITERIER (kort)
- Web/aktuelle fakta → DBC_WEB_SEARCH
- Bøger/værker/anbefalinger → DBC_MULTI_SEARCH
- Småsnak/system-/app-hjælp → DBC_BASE
- Alt andet → DBC_BASE

    `;

  const copy = [
    ...messages.filter((entry) => entry.role !== "system"),
    { role: "system", content: systemPrompt } as Message,
  ];

  const controller = new AbortController();

  const modelJSON: any = await new Promise(async (resolve, reject) => {
    let accumulatedText = "";

    try {
      await llmGenerate({
        controller,
        messages: copy,
        parameters,
        say: (chunk: any) => {
          accumulatedText += chunk?.token?.text || "";
          console.log("\n\n\n\nBIGBRAIN: accumulatedText", accumulatedText);
          // Regular expression to find JSON object in the accumulated text
          const jsonRegex = /{[^]*}/;
          const jsonString = accumulatedText.match(jsonRegex);

          if (jsonString) {
            try {
              // Parse the JSON string into an object
              const jsonObject = JSON.parse(jsonString[0]);

              // Abort the controller to stop further streaming
              controller.abort();

              if (!Object.values(MODEL_NAMES).includes(jsonObject?.modelName)) {
                jsonObject.modelName = MODEL_NAMES.DBC_BASE;
              }
              // Resolve the promise with the extracted JSON object
              resolve(jsonObject);
            } catch (error) {
              console.error("\n\n\n\nBIGBRAIN: Failed to parse JSON:", error);
              resolve({ modelName: MODEL_NAMES.DBC_BASE });
              reject(error);
            }
          }
        },
      });
    } catch (error) {
      console.error("Error during text streaming:", error);
      reject(error);
    }
  });

  // //TODO stop when json is found
  // const res = await llmGenerate({
  //   controller,
  //   messages: copy,
  //   parameters,
  //   say: (text: string) => {
  //     console.log("General.text", text);
  //   },
  // });

  //const json = extractJsonFromText(res);
  const modelName = Object.values(MODEL_NAMES).includes(modelJSON?.modelName)
    ? modelJSON?.modelName
    : MODEL_NAMES.DBC_BASE;

  PluginStatus.serialize({
    say,
    pluginName: id,
    description: `Valgte agent: ${modelName}`,
  });

  //Hack to typescript error. Return models[modelName];
  return models[modelName as keyof typeof models];
}
async function generate({ messages, parameters, say, close }: GenerateRequest) {
  //say("\nJeg tænker..\n\n");
  PluginStatus.serialize({
    say,
    pluginName: id,
    description: `Jeg tænker...`,
  });
  //run a prompt to determind which model to use
  //pass the prompt to the model
  const model = await getModelByPrompt({
    messages,
    parameters,
    say,
    close,
  });

  await model.generate({
    messages,
    parameters,
    say, // Remove this, if you don't want it to stream directly to client
    close,
  });
  //   model.generate {llmGenerate({
  //     messages,
  //     parameters,
  //     say, // Remove this, if you don't want it to stream directly to client
  //   });}

  PluginStatus.serialize({
    say,
    pluginName: id,
    description: `Færdig.`,
  });
  close();
}

export default {
  generate,
} as CustomModel;
