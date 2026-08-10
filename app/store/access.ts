import {
  ApiPath,
  DEFAULT_API_HOST,
  ServiceProvider,
  StoreKey,
} from "../constant";
import { getHeaders } from "../client/api";
import { getClientConfig } from "../config/client";
import {
  env,
  SKOLEGPT_REPLACEMENT_MODEL,
  SKOLEGPT_RETIRED_MODEL_ALIASES,
} from "../utils/appsettings";
import { createPersistStore } from "../utils/store";
import { ensure } from "../utils/clone";
import { DEFAULT_CONFIG } from "./config";

let fetchState = 0; // 0 not fetch, 1 fetching, 2 done

const DEFAULT_OPENAI_URL =
  getClientConfig()?.buildMode === "export"
    ? DEFAULT_API_HOST + "/api/proxy/openai"
    : ApiPath.OpenAI;

const DEFAULT_ACCESS_STATE = {
  accessCode: "",
  useCustomConfig: false,

  provider: ServiceProvider.OpenAI,

  // openai
  openaiUrl: DEFAULT_OPENAI_URL,
  openaiApiKey: "",

  // azure
  azureUrl: "",
  azureApiKey: "",
  azureApiVersion: "2023-08-01-preview",

  // server config
  needCode: true,
  hideUserApiKey: false,
  hideBalanceQuery: false,
  disableGPT4: false,
  disableFastLink: false,
  customModels: "",
  defaultModel: env.DEFAULT_MODEL ?? "",
};

export const useAccessStore = createPersistStore(
  { ...DEFAULT_ACCESS_STATE },

  (set, get) => ({
    enabledAccessControl() {
      this.fetch();

      return get().needCode;
    },

    isValidOpenAI() {
      return ensure(get(), ["openaiApiKey"]);
    },

    isValidAzure() {
      return ensure(get(), ["azureUrl", "azureApiKey", "azureApiVersion"]);
    },

    isAuthorized() {
      this.fetch();

      // has token or has code or disabled access control
      return (
        this.isValidOpenAI() ||
        this.isValidAzure() ||
        !this.enabledAccessControl() ||
        (this.enabledAccessControl() && ensure(get(), ["accessCode"]))
      );
    },

    getCustomModels() {
      return [, env.CUSTOM_MODELS, get().customModels]
        .filter((m) => m && m.length > 0)
        .join(",");
    },
    fetch() {
      if (fetchState > 0 || getClientConfig()?.buildMode === "export") return;
      fetchState = 1;
      fetch("/api/config", {
        method: "post",
        body: null,
        headers: {
          ...getHeaders(),
        },
      })
        .then((res) => res.json())
        .then((res) => {
          // Set default model from env request
          let defaultModel = res.defaultModel ?? "";
          DEFAULT_CONFIG.modelConfig.model =
            defaultModel !== ""
              ? defaultModel
              : env.DEFAULT_MODEL ?? "gpt-3.5-turbo";
          return res;
        })
        .then((res: DangerConfig) => {
          set(() => ({ ...res }));
        })
        .catch(() => {
          console.error("[Config] failed to fetch config");
        })
        .finally(() => {
          fetchState = 2;
        });
    },
  }),
  {
    name: StoreKey.Access,
    version: 3,
    migrate(persistedState, version) {
      if (version < 2) {
        const state = persistedState as {
          token: string;
          openaiApiKey: string;
          azureApiVersion: string;
        };
        state.openaiApiKey = state.token;
        state.azureApiVersion = "2023-08-01-preview";
      }

      if (version < 3 && env.APP === "skolegpt") {
        const state = persistedState as {
          defaultModel: string;
          customModels: string;
        };

        if (SKOLEGPT_RETIRED_MODEL_ALIASES.includes(state.defaultModel)) {
          state.defaultModel = SKOLEGPT_REPLACEMENT_MODEL;
        }

        if (state.customModels) {
          state.customModels = state.customModels
            .split(",")
            .filter((m) => !SKOLEGPT_RETIRED_MODEL_ALIASES.includes(m))
            .join(",");
        }
      }

      return persistedState as any;
    },
  },
);
