import base from "@/app/dbc/models/base";
import websearch from "@/app/dbc/models/websearch";
import simpleSearch from "@/app/dbc/models/simpleSearch";
import complexSearch from "@/app/dbc/models/complexSearch";

import visualsexamples from "@/app/dbc/models/visualsexamples";
import vectorDatabase from "@/app/dbc/models/vectorDatabase";
import generalModel from "@/app/dbc/models/general";
import multiSearch from "@/app/dbc/models/multiSearch";
import { MODEL_NAMES } from "@/app/dbc";

const models = {
  [MODEL_NAMES.DBC_SIMPLE_SEARCH]: simpleSearch,
  [MODEL_NAMES.DBC_COMPLEX_SEARCH]: complexSearch,

  [MODEL_NAMES.DBC_BASE]: base,
  [MODEL_NAMES.DBC_WEB_SEARCH]: websearch,

  // [MODEL_NAMES.DBC_HELLO_WORLD]: helloworld,
  // [MODEL_NAMES.DBC_POEM]: poem,
  [MODEL_NAMES.DBC_VISUALS_EXAMPLES]: visualsexamples,
  [MODEL_NAMES.DBC_VECTOR_DB]: vectorDatabase,
  [MODEL_NAMES.DBC_GENERAL_MODEL]: generalModel,
  [MODEL_NAMES.DBC_MULTI_SEARCH]: multiSearch,
};

export default models;
