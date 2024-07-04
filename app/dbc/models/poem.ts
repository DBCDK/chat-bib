import { CustomModel, GenerateRequest } from "..";
import { llmGenerate } from "../llmClient";

async function generate({ say, close }: GenerateRequest) {
  say("Lad mig fremføre et digt for dig om en kat..\n\n");

  const catPoem = await llmGenerate({
    messages: [
      { role: "user", content: "Skriv et digt på 4 linier om en kat" },
    ],
    parameters: {
      temperature: 0.2,
    },
    say, // Remove this, if you don't want it to stream directly to client
  });

  say("\n\nOg nu om en hund..\n\n");

  await llmGenerate({
    messages: [
      {
        role: "user",
        content: `Omskriv dette digt om en kat, så det handler om en hund. Digtet må fylde 4 linier\n\n${catPoem}`,
      },
    ],
    parameters: {
      temperature: 0.2,
    },
    say, // Remove this, if you don't want it to stream directly to client
  });

  say("\n\nSlut prut finale");
  close();
}

export default {
  generate,
} as CustomModel;
