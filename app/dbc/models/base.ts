import { CustomModel, GenerateRequest, MODEL_NAMES } from "../index";
import { llmGenerate } from "../llmClient";
import { ModelDescription } from "./modelsDescriptions";

async function generate({ messages, parameters, say, close }: GenerateRequest) {
  // We just pass it through to the LLM backend
  await llmGenerate({
    messages,
    parameters,
    say, // Remove this, if you don't want it to stream directly to client
  });
  close();
}

export const modelDescription: ModelDescription = {
  name: MODEL_NAMES.DBC_BASE,
  description: `En generel model til samtale og tekstgenerering. Den kan besvare almindelige spørgsmål, forklare begreber og hjælpe brugeren med at uddybe sin forespørgsel, fx hvis en anbefaling eller søgning mangler detaljer. Brug denne model til dialog, forklaringer og skrivehjælp — men IKKE til søgning, anbefaling af værker eller opslag af aktuelle data.`,
  // description:
  //   "Denne model kan besvare generelle spørgsmål. Den kan hjælpe med at uddybe spørgsmål som brugeren stiller. Eksempelvis hvis brugere spørger om en anbefaling eller søgning og brugern ikke har givet nok information om dette, kan denne model spørge brugere om at uddybe sit forespørgsel. Den kan generere tekst og svar ud fra brugerens input. Du må IKKE bruge denne model stil søgning eller anbefaling af værker. Den kan ikke slå aktuelle data op.",
};

export default {
  generate,
} as CustomModel;
