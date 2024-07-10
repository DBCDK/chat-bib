import { CustomModel, GenerateRequest } from "..";

async function generate({ messages, say, close }: GenerateRequest) {
  say("HELLO WORLD");
  close();
}

export default {
  generate,
} as CustomModel;
