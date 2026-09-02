import { trimTopic, getMessageTextContent } from "../utils";

import Locale, { getLang } from "../locales";
import { showToast } from "../components/ui-lib";
import { ModelConfig, ModelType, useAppConfig } from "./config";
import { createEmptyMask, Mask, useMaskStore } from "./mask";
import { BUILTIN_MASKS } from "../masks";
import {
  DEFAULT_INPUT_TEMPLATE,
  DEFAULT_MODELS,
  DEFAULT_SYSTEM_TEMPLATE,
  KnowledgeCutOffDate,
  ModelProvider,
  StoreKey,
  SUMMARIZE_MODEL,
  VISIBLE_DBC_LLM_ENDPOINT_MODELS,
} from "../constant";
import { SearchSpeed } from "../constant";
import {
  ClientApi,
  RequestMessage,
  MultimodalContent,
  FileAttachment,
} from "../client/api";
import { ChatControllerPool } from "../client/controller";
import { prettyObject } from "../utils/format";
import { estimateTokenLength } from "../utils/token";
import { nanoid } from "nanoid";
import { createPersistStore } from "../utils/store";
import { collectModelsWithDefaultModel } from "../utils/model";
import { useAccessStore } from "./access";
import { MessageRole } from "../typing";
import { DEFAULT_SYSTEM_PERSONA } from "../personas";
import {
  env,
  SKOLEGPT_REPLACEMENT_MODEL,
  SKOLEGPT_RETIRED_MODEL_ALIASES,
} from "../utils/appsettings";

export type ChatMessage = RequestMessage & {
  date: string;
  streaming?: boolean;
  isError?: boolean;
  id: string;
  model?: ModelType;
};

export function createMessage(override: Partial<ChatMessage>): ChatMessage {
  return {
    id: nanoid(),
    date: new Date().toLocaleString(),
    role: MessageRole.User,
    content: "",
    ...override,
  };
}

export interface ChatStat {
  tokenCount: number;
  wordCount: number;
  charCount: number;
}

export interface ChatSession {
  id: string;
  topic: string;

  memoryPrompt: string;
  messages: ChatMessage[];
  stat: ChatStat;
  lastUpdate: number;
  lastSummarizeIndex: number;
  clearContextIndex?: number;

  mask: Mask;
  // DBC simple search speed: per-session
  dbcSearchSpeed?: SearchSpeed;
  // Multi-LLM: if present, this session acts as a parent aggregating children
  multiLlmChildren?: ChatSession[];
  // Multi mode indicator for grid rendering.
  multiMode?: "llm" | "agents"; //agents: local personas(bib.dk, chatbib, faktalink etc.). llm: DBC LLM endpoint(gemma, mixtral etc.)
  // For child sessions only: the endpoint model to use at the DBC LLM endpoint
  llmModel?: string;
}

export const DEFAULT_TOPIC = Locale.Store.DefaultTopic;
const BOT_HELLO_CONTENT = Locale.Store.BotHello;
export const BOT_HELLO: ChatMessage = createMessage({
  role: MessageRole.Assistant,
  content: BOT_HELLO_CONTENT,
});

function getRequestContextPrompts(session: ChatSession) {
  return session.mask.context.filter(
    (message) =>
      message.role !== MessageRole.Assistant ||
      getMessageTextContent(message).trim() !== BOT_HELLO_CONTENT,
  );
}

function createEmptySession(): ChatSession {
  return {
    id: nanoid(),
    topic: DEFAULT_TOPIC,
    memoryPrompt: "",
    messages: [],
    stat: {
      tokenCount: 0,
      wordCount: 0,
      charCount: 0,
    },
    lastUpdate: Date.now(),
    lastSummarizeIndex: 0,

    mask: createEmptyMask(),
    dbcSearchSpeed: SearchSpeed.Fast,
  };
}

function getSummarizeModel(currentModel: string) {
  // if it is using gpt-* models, force to use 3.5 to summarize
  if (currentModel.startsWith("gpt")) {
    const configStore = useAppConfig.getState();
    const accessStore = useAccessStore.getState();
    const allModel = collectModelsWithDefaultModel(
      configStore.models,
      [configStore.customModels, accessStore.getCustomModels()].join(","),
      accessStore.defaultModel,
    );
    const summarizeModel = allModel.find(
      (m) => m.name === SUMMARIZE_MODEL && m.available,
    );
    return summarizeModel?.name ?? currentModel;
  }
  return currentModel;
}

function countMessages(msgs: ChatMessage[]) {
  return msgs.reduce(
    (pre, cur) => pre + estimateTokenLength(getMessageTextContent(cur)),
    0,
  );
}

function fillTemplateWith(input: string, modelConfig: ModelConfig) {
  const cutoff =
    KnowledgeCutOffDate[modelConfig.model] ?? KnowledgeCutOffDate.default;
  // Find the model in the DEFAULT_MODELS array that matches the modelConfig.model
  const modelInfo = DEFAULT_MODELS.find((m) => m.name === modelConfig.model);

  var serviceProvider = "OpenAI";
  if (modelInfo) {
    // TODO: auto detect the providerName from the modelConfig.model

    // Directly use the providerName from the modelInfo
    serviceProvider = modelInfo.provider.providerName;
  }

  const vars = {
    ServiceProvider: serviceProvider,
    cutoff,
    model: modelConfig.model,
    time: new Date().toString(),
    lang: getLang(),
    input: input,
  };

  let output = modelConfig.template ?? DEFAULT_INPUT_TEMPLATE;

  // remove duplicate
  if (input.startsWith(output)) {
    output = "";
  }

  // must contains {{input}}
  const inputVar = "{{input}}";
  if (!output.includes(inputVar)) {
    output += "\n" + inputVar;
  }

  Object.entries(vars).forEach(([name, value]) => {
    const regex = new RegExp(`{{${name}}}`, "g");
    output = output.replace(regex, value.toString()); // Ensure value is a string
  });

  return output;
}

const DEFAULT_CHAT_STATE = {
  sessions: [createEmptySession()],
  currentSessionIndex: 0,
};

export const useChatStore = createPersistStore(
  DEFAULT_CHAT_STATE,
  (set, _get) => {
    function get() {
      return {
        ..._get(),
        ...methods,
      };
    }
    function cleanupEmptySessions(
      state: Partial<typeof DEFAULT_CHAT_STATE> & {
        sessions: ChatSession[];
        currentSessionIndex: number;
      },
    ) {
      if (!env.CLEANUP_EMPTY_SESSIONS) {
        return state;
      }
      const { sessions, currentSessionIndex } = state;
      let newCurrentIndex = currentSessionIndex;
      const filteredSessions: ChatSession[] = sessions.filter(
        (session, index) => {
          let keep =
            session.messages.length > 0 || index === currentSessionIndex;
          if (!keep && index < currentSessionIndex) newCurrentIndex -= 1;
          return keep;
        },
      );
      return {
        ...state,
        sessions: filteredSessions,
        currentSessionIndex: newCurrentIndex,
      };
    }

    const methods = {
      startMultiLlm() {
        const session = get().currentSession();
        // Only allow starting multi-llm on empty chats
        if (session.messages.length > 0) {
          return false;
        }
        const endpointModels = VISIBLE_DBC_LLM_ENDPOINT_MODELS as string[];

        // Create three child sessions cloning current mask/config
        const children = endpointModels.map((m) => {
          const child = createEmptySession();
          child.mask = JSON.parse(JSON.stringify(session.mask));
          child.topic = `${session.topic} (${m})`;
          child.llmModel = m;
          return child;
        });

        set(() => {
          session.multiLlmChildren = children;
          session.multiMode = "llm";
          session.lastUpdate = Date.now();
          session.topic = "Multi-LLM";
          return { sessions: [...get().sessions] };
        });
        return true;
      },

      startMultiAgents() {
        const session = get().currentSession();
        // Only allow starting multi-agent on empty chats
        if (session.messages.length > 0) {
          return false;
        }
        // Build from eligible personas dynamically, cap at 5
        const { PERSONAS } = require("../personas");
        const eligible = (PERSONAS as any[])
          .filter((p) => p.multiAgentEligible)
          .slice(0, 5);

        if (eligible.length === 0) {
          return false;
        }

        const children = eligible.map((p) => {
          const child = createEmptySession();
          // Clone persona mask and use it for the child
          child.mask = JSON.parse(JSON.stringify(p.mask));
          child.topic = `${session.topic} (${p.name})`;
          // Always use chatbib endpoint model for multi-agent
          child.llmModel = "chatbib";
          return child;
        });

        set(() => {
          session.multiLlmChildren = children;
          session.multiMode = "agents";
          session.lastUpdate = Date.now();
          return { sessions: [...get().sessions] };
        });
        return true;
      },

      onUserInputSmart(content: string, attachImages?: string[]) {
        const session = get().currentSession();
        if (session.multiLlmChildren && session.multiLlmChildren.length > 0) {
          return get().onUserInputMultiLlm(content, attachImages);
        }
        return get().onUserInput(content, attachImages);
      },

      onUserInputMultiLlm(content: string, attachImages?: string[]) {
        const parent = get().currentSession();
        const children = parent.multiLlmChildren || [];
        if (children.length === 0) return;

        // Send to each child in parallel
        children.forEach((child, idx) => {
          get()._onUserInputForChild(parent, child, content, attachImages);
        });
      },

      onUserInputToChild(
        childId: string,
        content: string,
        attachImages?: string[],
      ) {
        const parent = get().currentSession();
        const child = parent.multiLlmChildren?.find((c) => c.id === childId);
        if (!child) return;
        return get()._onUserInputForChild(parent, child, content, attachImages);
      },

      _getMessagesWithMemoryFor(target: ChatSession) {
        const modelConfig = target.mask.modelConfig;
        const clearContextIndex = target.clearContextIndex ?? 0;
        const messages = target.messages.slice();
        const totalMessageCount = target.messages.length;

        const contextPrompts = getRequestContextPrompts(target);

        const shouldInjectSystemPrompts =
          modelConfig.enableInjectSystemPrompts &&
          target.mask.modelConfig.model.startsWith("gpt-");

        var systemPrompts: ChatMessage[] = [];
        systemPrompts = shouldInjectSystemPrompts
          ? [
            createMessage({
              role: MessageRole.System,
              content: fillTemplateWith("", {
                ...modelConfig,
                template: DEFAULT_SYSTEM_TEMPLATE,
              }),
            }),
          ]
          : [];

        const memoryPrompt = undefined as any; // disable cross-child memory for now
        const shouldSendLongTermMemory = false;
        const longTermMemoryPrompts: ChatMessage[] = [];
        const longTermMemoryStartIndex = 0;

        const shortTermMemoryStartIndex = Math.max(
          0,
          totalMessageCount - modelConfig.historyMessageCount,
        );

        const memoryStartIndex = shouldSendLongTermMemory
          ? Math.min(longTermMemoryStartIndex, shortTermMemoryStartIndex)
          : shortTermMemoryStartIndex;
        const contextStartIndex = Math.max(clearContextIndex, memoryStartIndex);
        const maxTokenThreshold = modelConfig.max_tokens;

        const reversedRecentMessages = [] as ChatMessage[];
        for (
          let i = totalMessageCount - 1, tokenCount = 0;
          i >= contextStartIndex && tokenCount < maxTokenThreshold;
          i -= 1
        ) {
          const msg = messages[i];
          if (!msg || msg.isError) continue;
          tokenCount += estimateTokenLength(getMessageTextContent(msg));
          reversedRecentMessages.push(msg);
        }

        const recentMessages = [
          ...systemPrompts,
          ...longTermMemoryPrompts,
          ...contextPrompts,
          ...reversedRecentMessages.reverse(),
        ];

        return recentMessages;
      },

      _onUserInputForChild(
        parent: ChatSession,
        target: ChatSession,
        content: string,
        attachImages?: string[],
      ) {
        const modelConfig = target.mask.modelConfig;
        const userContent = fillTemplateWith(content, modelConfig);

        let mContent: string | MultimodalContent[] = userContent;
        if (attachImages && attachImages.length > 0) {
          mContent = [
            {
              type: "text",
              text: userContent,
            },
          ];
          mContent = mContent.concat(
            attachImages.map((url) => ({
              type: "image_url",
              image_url: { url },
            })),
          );
        }

        let userMessage: ChatMessage = createMessage({
          role: MessageRole.User,
          content: mContent,
        });

        // For better UX in multi-pane, display the raw user input immediately
        // while still sending the templated content to the backend.
        let uiContent: string | MultimodalContent[] = content;
        if (attachImages && attachImages.length > 0) {
          uiContent = [
            { type: "text" as const, text: content },
            ...attachImages.map((url) => ({
              type: "image_url" as const,
              image_url: { url },
            })),
          ];
        }

        const botMessage: ChatMessage = createMessage({
          role: MessageRole.Assistant,
          streaming: true,
          model: modelConfig.model,
        });

        const recentMessages = get()._getMessagesWithMemoryFor(target);
        const sendMessages = recentMessages.concat(userMessage);
        const messageIndex = target.messages.length + 1;

        // save messages into child
        set((state) => {
          const sessions = state.sessions.slice();
          const parentIndex = sessions.findIndex((x) => x.id === parent.id);
          if (parentIndex >= 0) {
            const parentCopy: ChatSession = { ...sessions[parentIndex] } as any;
            const childrenCopy = (parentCopy.multiLlmChildren || []).slice();
            const childIndex = childrenCopy.findIndex(
              (c) => c.id === target.id,
            );
            if (childIndex >= 0) {
              const targetChild = {
                ...childrenCopy[childIndex],
              } as ChatSession;
              targetChild.messages = targetChild.messages.concat([
                { ...userMessage, content: uiContent },
                botMessage,
              ]);
              childrenCopy[childIndex] = targetChild;
              parentCopy.multiLlmChildren = childrenCopy;
              parentCopy.lastUpdate = Date.now();
              sessions[parentIndex] = parentCopy;
            }
          }
          return { sessions };
        });

        var api: ClientApi;
        if (modelConfig.model.startsWith("dbc")) {
          api = new ClientApi(ModelProvider.DBC);
        } else {
          api = new ClientApi(ModelProvider.GPT);
        }

        api.llm.chat({
          messages: sendMessages,
          config: { ...modelConfig, stream: true, llmModel: target.llmModel },
          onUpdate(message) {
            botMessage.streaming = true;
            if (message) {
              botMessage.content = message;
            }
            set((state) => ({ sessions: state.sessions.slice() }));
          },
          onFinish(message) {
            botMessage.streaming = false;
            if (message) {
              botMessage.content = message;
              // do not change parent summary for now; just update lastUpdate
              set((state) => {
                const sessions = state.sessions.slice();
                const i = sessions.findIndex((x) => x.id === parent.id);
                if (i >= 0) {
                  const p = { ...sessions[i] } as ChatSession;
                  p.lastUpdate = Date.now();
                  sessions[i] = p;
                }
                return { sessions };
              });
            }
            ChatControllerPool.remove(target.id, botMessage.id);
          },
          onError(error) {
            const isAborted = error.message.includes("aborted");
            botMessage.content +=
              "\n\n" +
              prettyObject({
                error: true,
                message: error.message,
              });
            botMessage.streaming = false;
            userMessage.isError = !isAborted;
            botMessage.isError = !isAborted;
            set((state) => ({ sessions: state.sessions.slice() }));
            ChatControllerPool.remove(target.id, botMessage.id ?? messageIndex);
            console.error("[Chat child] failed ", error);
          },
          onController(controller) {
            ChatControllerPool.addController(
              target.id,
              botMessage.id ?? messageIndex,
              controller,
            );
          },
          conversationIdOverride: target.id,
        });
      },
      clearSessions() {
        set(() => ({
          sessions: [createEmptySession()],
          currentSessionIndex: 0,
        }));
      },

      selectSession(index: number) {
        set((state) =>
          cleanupEmptySessions({
            ...state,
            currentSessionIndex: index,
          }),
        );
      },

      moveSession(from: number, to: number) {
        set((state) => {
          const { sessions, currentSessionIndex: oldIndex } = state;

          // move the session
          const newSessions = [...sessions];
          const session = newSessions[from];
          newSessions.splice(from, 1);
          newSessions.splice(to, 0, session);

          // modify current session id
          let newIndex = oldIndex === from ? to : oldIndex;
          if (oldIndex > from && oldIndex <= to) {
            newIndex -= 1;
          } else if (oldIndex < from && oldIndex >= to) {
            newIndex += 1;
          }

          return {
            currentSessionIndex: newIndex,
            sessions: newSessions,
          };
        });
      },

      newSession(mask?: Mask) {
        const session = createEmptySession();

        let sessionMask = mask ? mask : DEFAULT_SYSTEM_PERSONA.mask;
        const config = useAppConfig.getState();
        const globalModelConfig = config.modelConfig;

        if (!mask && env.DEFAULT_MASK) {
          let masks = useMaskStore.getState().getAll();
          sessionMask =
            masks.find((m) => m.name === env.DEFAULT_MASK && m.builtin) ||
            masks[0];
        }

        session.mask = {
          ...sessionMask,
          modelConfig: {
            ...globalModelConfig,
            ...sessionMask.modelConfig,
          },
        };
        session.topic = DEFAULT_TOPIC;
        if (env.USE_MASK_AS_SESSION_NAME) {
          session.topic = sessionMask.name;
        }

        set((state) =>
          cleanupEmptySessions({
            ...state,
            currentSessionIndex: 0,
            sessions: [session].concat(state.sessions),
          }),
        );
      },

      nextSession(delta: number) {
        const n = get().sessions.length;
        const limit = (x: number) => (x + n) % n;
        const i = get().currentSessionIndex;
        get().selectSession(limit(i + delta));
      },

      deleteSession(index: number) {
        const deletingLastSession = get().sessions.length === 1;
        const deletedSession = get().sessions.at(index);

        if (!deletedSession) return;

        const sessions = get().sessions.slice();
        sessions.splice(index, 1);

        const currentIndex = get().currentSessionIndex;
        let nextIndex = Math.min(
          currentIndex - Number(index < currentIndex),
          sessions.length - 1,
        );

        // for undo delete action
        const restoreState = {
          currentSessionIndex: get().currentSessionIndex,
          sessions: get().sessions.slice(),
        };

        set(() => ({
          currentSessionIndex: nextIndex,
          sessions,
        }));
        if (deletingLastSession) {
          get().newSession();
        }

        showToast(
          Locale.Home.DeleteToast,
          {
            text: Locale.Home.Revert,
            onClick() {
              set(() => restoreState);
            },
          },
          5000,
        );
      },

      currentSession() {
        let index = get().currentSessionIndex;
        const sessions = get().sessions;

        if (index < 0 || index >= sessions.length) {
          index = Math.min(sessions.length - 1, Math.max(0, index));
          set(() => ({ currentSessionIndex: index }));
        }

        const session = sessions[index];

        if (
          env.CLEANUP_EMPTY_SESSIONS &&
          sessions.length === 1 &&
          session?.topic === "Nyoprettet Assistent" &&
          session?.mask?.name === DEFAULT_TOPIC &&
          session?.mask?.context?.[0]?.content === "" &&
          session.messages.length == 0
        ) {
          get().deleteSession(index);
        }

        return session;
      },

      onNewMessage(message: ChatMessage) {
        get().updateCurrentSession((session) => {
          session.messages = session.messages.concat();
          session.lastUpdate = Date.now();
        });
        get().updateStat(message);
        get().summarizeSession();
      },

      async onUserInput(
        content: string,
        attachImages?: string[],
        attachFiles?: FileAttachment[],
        attachImageNames?: string[],
      ) {
        const session = get().currentSession();
        const modelConfig = session.mask.modelConfig;

        const userContent = fillTemplateWith(content, modelConfig);

        let mContent: string | MultimodalContent[] = userContent;

        const hasImages = !!attachImages?.length;
        const hasFiles = !!attachFiles?.length;
        if (hasImages || hasFiles) {
          mContent = [{ type: "text", text: userContent }];
          if (hasImages) {
            mContent = mContent.concat(
              attachImages!.map((url, i) => ({
                type: "image_url",
                image_url: { url, name: attachImageNames?.[i] },
              })),
            );
          }
          if (hasFiles) {
            mContent = mContent.concat(
              attachFiles!.map((file) => ({ type: "file", file })),
            );
          }
        }
        let userMessage: ChatMessage = createMessage({
          role: MessageRole.User,
          content: mContent,
        });

        const botMessage: ChatMessage = createMessage({
          role: MessageRole.Assistant,
          streaming: true,
          model: modelConfig.model,
        });

        // get recent messages
        const recentMessages = get().getMessagesWithMemory();
        const sendMessages = recentMessages.concat(userMessage);
        const messageIndex = get().currentSession().messages.length + 1;

        // save user's and bot's message
        get().updateCurrentSession((session) => {
          const savedUserMessage = {
            ...userMessage,
            content: mContent,
          };
          session.messages = session.messages.concat([
            savedUserMessage,
            botMessage,
          ]);
        });

        var api: ClientApi;
        if (modelConfig.model.startsWith("dbc")) {
          api = new ClientApi(ModelProvider.DBC);
        } else {
          api = new ClientApi(ModelProvider.GPT);
        }

        // make request
        api.llm.chat({
          messages: sendMessages,
          config: { ...modelConfig, stream: true },
          onUpdate(message) {
            botMessage.streaming = true;
            if (message) {
              botMessage.content = message;
            }
            get().updateCurrentSession((session) => {
              session.messages = session.messages.concat();
            });
          },
          onFinish(message) {
            botMessage.streaming = false;
            if (message) {
              botMessage.content = message;
              get().onNewMessage(botMessage);
            }
            ChatControllerPool.remove(session.id, botMessage.id);
          },
          onError(error) {
            const isAborted = error.message.includes("aborted");
            botMessage.content +=
              "\n\n" +
              prettyObject({
                error: true,
                message: error.message,
              });
            botMessage.streaming = false;
            userMessage.isError = !isAborted;
            botMessage.isError = !isAborted;
            get().updateCurrentSession((session) => {
              session.messages = session.messages.concat();
            });
            ChatControllerPool.remove(
              session.id,
              botMessage.id ?? messageIndex,
            );

            console.error("[Chat] failed ", error);
          },
          onController(controller) {
            // collect controller for stop/retry
            ChatControllerPool.addController(
              session.id,
              botMessage.id ?? messageIndex,
              controller,
            );
          },
        });
      },

      getMemoryPrompt() {
        const session = get().currentSession();

        if (session.memoryPrompt.length) {
          return {
            role: MessageRole.System,
            content: Locale.Store.Prompt.History(session.memoryPrompt),
            date: "",
          } as ChatMessage;
        }
      },

      getMessagesWithMemory() {
        const session = get().currentSession();
        const modelConfig = session.mask.modelConfig;
        const clearContextIndex = session.clearContextIndex ?? 0;
        const messages = session.messages.slice();
        const totalMessageCount = session.messages.length;

        // in-context prompts
        const contextPrompts = getRequestContextPrompts(session);

        // system prompts, to get close to OpenAI Web ChatGPT
        const shouldInjectSystemPrompts =
          modelConfig.enableInjectSystemPrompts &&
          session.mask.modelConfig.model.startsWith("gpt-");

        var systemPrompts: ChatMessage[] = [];
        systemPrompts = shouldInjectSystemPrompts
          ? [
            createMessage({
              role: MessageRole.System,
              content: fillTemplateWith("", {
                ...modelConfig,
                template: DEFAULT_SYSTEM_TEMPLATE,
              }),
            }),
          ]
          : [];
        if (shouldInjectSystemPrompts) {
          console.log(
            "[Global System Prompt] ",
            systemPrompts.at(0)?.content ?? "empty",
          );
        }
        const memoryPrompt = get().getMemoryPrompt();
        // long term memory
        const shouldSendLongTermMemory =
          modelConfig.sendMemory &&
          session.memoryPrompt &&
          session.memoryPrompt.length > 0 &&
          session.lastSummarizeIndex > clearContextIndex;
        const longTermMemoryPrompts =
          shouldSendLongTermMemory && memoryPrompt ? [memoryPrompt] : [];
        const longTermMemoryStartIndex = session.lastSummarizeIndex;

        // short term memory
        const shortTermMemoryStartIndex = Math.max(
          0,
          totalMessageCount - modelConfig.historyMessageCount,
        );

        // lets concat send messages, including 4 parts:
        // 0. system prompt: to get close to OpenAI Web ChatGPT
        // 1. long term memory: summarized memory messages
        // 2. pre-defined in-context prompts
        // 3. short term memory: latest n messages
        // 4. newest input message
        const memoryStartIndex = shouldSendLongTermMemory
          ? Math.min(longTermMemoryStartIndex, shortTermMemoryStartIndex)
          : shortTermMemoryStartIndex;
        // and if user has cleared history messages, we should exclude the memory too.
        const contextStartIndex = Math.max(clearContextIndex, memoryStartIndex);
        const maxTokenThreshold = modelConfig.max_tokens;

        // get recent messages as much as possible
        const reversedRecentMessages = [];
        for (
          let i = totalMessageCount - 1, tokenCount = 0;
          i >= contextStartIndex && tokenCount < maxTokenThreshold;
          i -= 1
        ) {
          const msg = messages[i];
          if (!msg || msg.isError) continue;
          tokenCount += estimateTokenLength(getMessageTextContent(msg));
          reversedRecentMessages.push(msg);
        }
        // concat all messages
        const recentMessages = [
          ...systemPrompts,
          ...longTermMemoryPrompts,
          ...contextPrompts,
          ...reversedRecentMessages.reverse(),
        ];

        return recentMessages;
      },

      updateMessage(
        sessionIndex: number,
        messageIndex: number,
        updater: (message?: ChatMessage) => void,
      ) {
        const sessions = get().sessions;
        const session = sessions.at(sessionIndex);
        const messages = session?.messages;
        updater(messages?.at(messageIndex));
        set(() => ({ sessions }));
      },

      resetSession() {
        get().updateCurrentSession((session) => {
          session.messages = [];
          session.memoryPrompt = "";
        });
      },

      summarizeSession() {
        const config = useAppConfig.getState();
        const session = get().currentSession();
        const modelConfig = session.mask.modelConfig;

        var api: ClientApi;
        if (modelConfig.model.startsWith("dbc")) {
          api = new ClientApi(ModelProvider.DBC);
        } else {
          api = new ClientApi(ModelProvider.GPT);
        }

        // remove error messages if any
        const messages = session.messages;

        // should summarize topic after chating more than 10 or 50 words
        const SUMMARIZE_MIN_LEN = env.APP === "skolegpt" ? 10 : 50;

        if (
          config.enableAutoGenerateTitle &&
          session.topic === DEFAULT_TOPIC &&
          countMessages(messages) >= SUMMARIZE_MIN_LEN
        ) {
          const topicMessages = messages.concat(
            createMessage({
              role: MessageRole.System,
              content: Locale.Store.Prompt.Topic,
            }),
          );
          api.llm.chat({
            messages: topicMessages,
            config: {
              model: getSummarizeModel(session.mask.modelConfig.model),
              stream: false,
            },
            onFinish(message) {
              get().updateCurrentSession(
                (session) =>
                (session.topic =
                  message.length > 0 ? trimTopic(message) : DEFAULT_TOPIC),
              );
            },
          });
        }
        const summarizeIndex = Math.max(
          session.lastSummarizeIndex,
          session.clearContextIndex ?? 0,
        );
        let toBeSummarizedMsgs = messages
          .filter((msg) => !msg.isError)
          .slice(summarizeIndex);

        const historyMsgLength = countMessages(toBeSummarizedMsgs);

        if (historyMsgLength > (modelConfig?.max_tokens || 4000)) {
          const n = toBeSummarizedMsgs.length;
          toBeSummarizedMsgs = toBeSummarizedMsgs.slice(
            Math.max(0, n - modelConfig.historyMessageCount),
          );
        }
        const memoryPrompt = get().getMemoryPrompt();
        if (memoryPrompt) {
          // add memory prompt
          toBeSummarizedMsgs.unshift(memoryPrompt);
        }

        const lastSummarizeIndex = session.messages.length;

        if (
          (toBeSummarizedMsgs.length >= modelConfig.historyMessageCount ||
            historyMsgLength > modelConfig.compressMessageLengthThreshold) &&
          modelConfig.sendMemory
        ) {
          /** Destruct max_tokens while summarizing
           * this param is just shit
           **/
          const { max_tokens, ...modelcfg } = modelConfig;
          api.llm.chat({
            messages: toBeSummarizedMsgs.concat(
              createMessage({
                role: MessageRole.System,
                content: Locale.Store.Prompt.Summarize,
                date: "",
              }),
            ),
            config: {
              ...modelcfg,
              stream: true,
              model: getSummarizeModel(session.mask.modelConfig.model),
            },
            onUpdate(message) {
              session.memoryPrompt = message;
            },
            onFinish(message) {
              console.log("[Memory] ", message);
              get().updateCurrentSession((session) => {
                session.lastSummarizeIndex = lastSummarizeIndex;
                session.memoryPrompt = message; // Update the memory prompt for stored it in local storage
              });
            },
            onError(err) {
              console.error("[Summarize] ", err);
            },
          });
        }
      },

      updateStat(message: ChatMessage) {
        get().updateCurrentSession((session) => {
          session.stat.charCount += message.content.length;
          // TODO: should update chat count and word count
        });
      },

      updateCurrentSession(updater: (session: ChatSession) => void) {
        const sessions = get().sessions;
        const index = get().currentSessionIndex;
        updater(sessions[index]);
        set(() => ({ sessions }));
      },

      clearAllData() {
        localStorage.clear();
        location.reload();
      },
    };

    function fixEmptyConversation() {
      // The masks-store are not loaded at initialisation time,
      // so the default empty session has an empty mask in skolegpt.
      // This function is called after a delay to ensure that
      // the correct mask is used for the initial empty session.
      const chatStore = get();
      if (
        chatStore.sessions.length == 1 &&
        chatStore.sessions[0].messages.length == 0
      ) {
        let mask = chatStore.sessions[0].mask;
        if (mask.avatar == "gpt-bot" && mask.context.length == 0) {
          chatStore.newSession();
          chatStore.deleteSession(1);
        }
      }
    }
    if (typeof window != "undefined")
      for (const i of [20, 100, 200, 500, 1000, 2000, 5000, 10000])
        setTimeout(fixEmptyConversation, i);

    return methods;
  },
  {
    name: StoreKey.Chat,
    version: 3.2,
    migrate(persistedState, version) {
      const state = persistedState as any;
      const newState = JSON.parse(
        JSON.stringify(state),
      ) as typeof DEFAULT_CHAT_STATE;

      // Everything below runs inside a try/catch on purpose. If this function
      // throws, zustand abandons hydration entirely: the store keeps its
      // defaults and the next write persists those defaults over the user's
      // real data, so a single malformed session costs them every chat they
      // have. Degrading to "some sessions were not migrated" is always better.
      try {
        if (version < 2) {
          newState.sessions = [];

          const oldSessions = state.sessions;
          for (const oldSession of oldSessions) {
            const newSession = createEmptySession();
            newSession.topic = oldSession.topic;
            newSession.messages = [...oldSession.messages];
            newSession.mask.modelConfig.sendMemory = true;
            newSession.mask.modelConfig.historyMessageCount =
              env.DEFAULT_MESSAGE_COUNT
                ? parseInt(env.DEFAULT_MESSAGE_COUNT)
                : 4;
            newSession.mask.modelConfig.compressMessageLengthThreshold = 1000;
            newState.sessions.push(newSession);
          }
        }

        if (version < 3) {
          // migrate id to nanoid
          newState.sessions.forEach((s) => {
            s.id = nanoid();
            s.messages.forEach((m) => (m.id = nanoid()));
          });
        }

        // Enable `enableInjectSystemPrompts` attribute for old sessions.
        // Resolve issue of old sessions not automatically enabling.
        if (version < 3.1) {
          newState.sessions.forEach((s) => {
            if (
              // Exclude those already set by user
              !s.mask.modelConfig.hasOwnProperty("enableInjectSystemPrompts")
            ) {
              // Because users may have changed this configuration,
              // the user's current configuration is used instead of the default
              const config = useAppConfig.getState();
              s.mask.modelConfig.enableInjectSystemPrompts =
                config.modelConfig.enableInjectSystemPrompts;
            }
          });
        }

        if (version < 3.2 && env.APP === "skolegpt") {
          // Optional chaining throughout: sessions written by older builds are
          // not guaranteed to have a well-formed mask.
          newState.sessions?.forEach((s) => {
            const model = s.mask?.modelConfig?.model;
            if (model && SKOLEGPT_RETIRED_MODEL_ALIASES.includes(model)) {
              s.mask.modelConfig.model = SKOLEGPT_REPLACEMENT_MODEL;
            }
            s.messages?.forEach((m) => {
              if (m.model && SKOLEGPT_RETIRED_MODEL_ALIASES.includes(m.model)) {
                m.model = SKOLEGPT_REPLACEMENT_MODEL;
              }
            });
          });
        }
      } catch (e) {
        console.error(
          "[chat store] migration failed; keeping the user's data unmigrated",
          e,
        );
      }

      return newState as any;
    },
  },
);
