import { CustomModel, GenerateRequest, MODEL_NAMES } from "../index";

import { ModelDescription } from "./modelsDescriptions";
import multiSearch from "./multiSearch";

async function generate({ messages, parameters, say, close }: GenerateRequest) {
  return multiSearch.generate({
    messages,
    parameters,
    say,
    close,
    useContextForSearch: false,
  });
}

export const modelDescription: ModelDescription = {
  name: MODEL_NAMES.DBC_MULTI_SEARCH_NO_CONTEXT,
  description: `Samme som dbc-multi-search, men bruger kun seneste besked til at danne søgninger`,
};

export default {
  generate,
} as CustomModel;
