import { modelDescription as multisearchDescription } from ".//multiSearch";

import { modelDescription as websearchDescription } from "./websearch";
import { modelDescription as dbcBaseDescription } from "./base";

export interface ModelDescription {
  name: string;
  description: string;
}
export const modelsDescriptions: ModelDescription[] = [
  multisearchDescription,
  websearchDescription,
  dbcBaseDescription,
];
