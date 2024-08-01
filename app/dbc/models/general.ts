import models from "@/app/dbc/models/models";
import { CustomModel, GenerateRequest, Message, MODEL_NAMES } from "../index";
import { llmGenerate } from "../llmClient";
import { modelsDescriptions } from "./modelsDescriptions";
import { extractJsonFromText } from "./utils";
import PluginStatus from "../components/PluginStatus/PluginStatus";
const id = MODEL_NAMES.DBC_GENERAL_MODEL;

async function getModelByPrompt({
  messages,
  parameters,
  say,
}: GenerateRequest): Promise<{ generate: Function }> {
  const systemPrompt = `
    Ud fra samtalen, skal du finde ud af om hvilken model der skal bruges. Du skal vælge en model fra følgende: ${JSON.stringify(modelsDescriptions)}.
    
    Du svarer ALDRIG selv på spørgsmålet.

    
    Hvis du er i tvivl om hvilken model der skal bruges, skal du bruge ${MODEL_NAMES.DBC_BASE}. 
    
    
    Du returnerer KUN dette json format, aldrig andet:
    {"modelName": navn på model}
    
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
    say: (text: string) => {
      console.log("General.text", text);
    },
  });

  const json = extractJsonFromText(res);
  console.log("json", json);
  const modelName = Object.values(MODEL_NAMES).includes(json?.modelName)
    ? json?.modelName
    : MODEL_NAMES.DBC_BASE;

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
