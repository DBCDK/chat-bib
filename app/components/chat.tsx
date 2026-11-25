import {
  getAttachmentCoverage,
  type AttachmentCoverage,
} from "../utils/message-content";
import { imageTokensFromUrl } from "../utils/gemma-image-tokens";
import { useDebouncedCallback } from "use-debounce";
import React, {
  useState,
  useRef,
  useEffect,
  useMemo,
  useCallback,
  Fragment,
  RefObject,
} from "react";
import { RecorderIcon } from "./recorder-icon";

import SendWhiteIcon from "../icons/send-white.svg";
import SendArrowIcon from "../icons/send-arrow.svg";
import BrainIcon from "../icons/brain.svg";
import RenameIcon from "../icons/rename.svg";
import ExportIcon from "../icons/share.svg";
import ReturnIcon from "../icons/return.svg";
import CopyIcon from "../icons/copy.svg";
import LoadingIcon from "../icons/three-dots.svg";
import LoadingButtonIcon from "../icons/loading.svg";
import PromptIcon from "../icons/prompt.svg";
import MaskIcon from "../icons/mask.svg";
import MaxIcon from "../icons/max.svg";
import MinIcon from "../icons/min.svg";
import EmailIcon from "../icons/email.svg";
import ResetIcon from "../icons/reload.svg";
import BreakIcon from "../icons/break.svg";
import SettingsIcon from "../icons/chat-settings.svg";
import DeleteIcon from "../icons/clear.svg";
import PinIcon from "../icons/pin.svg";
import EditIcon from "../icons/rename.svg";
import ConfirmIcon from "../icons/confirm.svg";
import CancelIcon from "../icons/cancel.svg";
import PlusIcon from "../icons/plus.svg";
import WarningIcon from "../icons/warning.svg";
import RetryIcon from "../icons/retry.svg";
import InfoIcon from "../icons/info.svg";
import AttachIcon from "../icons/attach.svg";
import PluginIcon from "../icons/plugin.svg";
import LightIcon from "../icons/light.svg";
import DarkIcon from "../icons/dark.svg";
import SpeakerTtsIcon from "../icons/speaker-Tts.svg";
import SpeakerTtsOffIcon from "../icons/speaker-tts-off.svg";
import CopyTextIcon from "../icons/copy-text.svg";
import AutoIcon from "../icons/auto.svg";
import BottomIcon from "../icons/bottom.svg";
import StopIcon from "../icons/pause.svg";
import RobotIcon from "../icons/robot.svg";
import EyeIcon from "../icons/eye.svg";

import {
  ChatMessage,
  SubmitKey,
  useChatStore,
  BOT_HELLO,
  createMessage,
  useAccessStore,
  Theme,
  useAppConfig,
  DEFAULT_TOPIC,
  ModelType,
} from "../store";

import {
  copyToClipboard,
  selectOrCopy,
  autoGrowTextArea,
  useMobileScreen,
  getMessageTextContent,
  getMessageImages,
  getMessageImageNames,
  getMessageFiles,
  isVisionModel,
  trackMatomoEvent,
  isAttachmentBudgetFull,
} from "../utils";

import { compressImage } from "@/app/utils/chat";
import {
  fileToAttachment,
  isImageFile,
  FILE_ACCEPT,
  DOCX_MIME,
} from "../utils/attachment";
import { loadFileBlob, deleteFileBlob } from "../utils/file-store";

import dynamic from "next/dynamic";

import { ChatControllerPool } from "../client/controller";
import { Prompt, usePromptStore } from "../store/prompt";
import Locale from "../locales";

import { IconButton } from "./button";
import styles from "./chat.module.scss";

import {
  List,
  ListItem,
  Modal,
  Selector,
  showConfirm,
  showPrompt,
  showToast,
} from "./ui-lib";
import { useNavigate, Link } from "react-router-dom";
import {
  CHAT_PAGE_SIZE,
  DBC_LLM_ENDPOINT_MODEL_CONFIG,
  type DbcLlmEndpointModel,
  LAST_INPUT_KEY,
  MALICIOUS_ANSWER,
  MAX_ATTACHED_IMAGES,
  Path,
  REQUEST_TIMEOUT_MS,
  UNFINISHED_INPUT,
} from "../constant";
import { Avatar } from "./emoji";
import { ContextPrompts, MaskAvatar, MaskConfig } from "./mask";
import { useMaskStore } from "../store/mask";
import { ChatCommandPrefix, useChatCommand, useCommand } from "../command";
import { ExportMessageModal } from "./exporter";

import { FeedbackModal } from "./feedback";
import { getClientConfig } from "../config/client";
import { useAllModels } from "../utils/hooks";
import { FileAttachment, MultimodalContent } from "../client/api";
import { MessageRole } from "../typing";
import exp from "constants";
import { DbcSettings } from "./dbcsettings";
import { TTSButton, useTts } from "./TTSButton";
import { env } from "../utils/appsettings";

const Markdown = dynamic(async () => (await import("./markdown")).Markdown, {
  loading: () => <LoadingIcon />,
});

const getLlmModelLabel = (model?: string) =>
  model && model in DBC_LLM_ENDPOINT_MODEL_CONFIG
    ? DBC_LLM_ENDPOINT_MODEL_CONFIG[model as DbcLlmEndpointModel].label
    : model || "";
export function SessionConfigModel(props: { onClose: () => void }) {
  const chatStore = useChatStore();
  const session = chatStore.currentSession();
  const maskStore = useMaskStore();
  const navigate = useNavigate();

  return (
    <div className="modal-mask">
      <Modal
        title={Locale.Context.Edit}
        onClose={() => props.onClose()}
        actions={[
          <IconButton
            key="reset"
            icon={<ResetIcon />}
            bordered
            text={Locale.Chat.Config.Reset}
            onClick={async () => {
              if (await showConfirm(Locale.Memory.ResetConfirm)) {
                chatStore.updateCurrentSession(
                  (session) => (session.memoryPrompt = ""),
                );
              }
            }}
          />,
          <IconButton
            key="copy"
            icon={<CopyIcon />}
            bordered
            text={Locale.Chat.Config.SaveAs}
            onClick={() => {
              navigate(Path.Masks);
              setTimeout(() => {
                maskStore.create(session.mask);
              }, 500);
            }}
          />,
        ]}
      >
        <MaskConfig
          mask={session.mask}
          updateMask={(updater) => {
            const mask = { ...session.mask };
            updater(mask);
            chatStore.updateCurrentSession((session) => (session.mask = mask));
          }}
          shouldSyncFromGlobal
          extraListItems={
            session.mask.modelConfig.sendMemory ? (
              <ListItem
                className="copyable"
                title={`${Locale.Memory.Title} (${session.lastSummarizeIndex} of ${session.messages.length})`}
                subTitle={session.memoryPrompt || Locale.Memory.EmptyContent}
              ></ListItem>
            ) : (
              <></>
            )
          }
        ></MaskConfig>
      </Modal>
    </div>
  );
}

function PromptToast(props: {
  showToast?: boolean;
  showModal?: boolean;
  setShowModal: (_: boolean) => void;
}) {
  const chatStore = useChatStore();
  const session = chatStore.currentSession();
  const context = session.mask.context;

  return (
    <div className={styles["prompt-toast"]} key="prompt-toast">
      {props.showToast && (
        <div
          className={styles["prompt-toast-inner"] + " clickable"}
          role="button"
          onClick={() => props.setShowModal(true)}
        >
          <BrainIcon />
          <span className={styles["prompt-toast-content"]}>
            {Locale.Context.Toast(context.length)}
          </span>
        </div>
      )}
      {props.showModal && (
        <SessionConfigModel onClose={() => props.setShowModal(false)} />
      )}
    </div>
  );
}

function useSubmitHandler() {
  const config = useAppConfig();
  const submitKey = config.submitKey;
  const isComposing = useRef(false);

  useEffect(() => {
    const onCompositionStart = () => {
      isComposing.current = true;
    };
    const onCompositionEnd = () => {
      isComposing.current = false;
    };

    window.addEventListener("compositionstart", onCompositionStart);
    window.addEventListener("compositionend", onCompositionEnd);

    return () => {
      window.removeEventListener("compositionstart", onCompositionStart);
      window.removeEventListener("compositionend", onCompositionEnd);
    };
  }, []);

  const shouldSubmit = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Fix Chinese input method "Enter" on Safari
    if (e.keyCode == 229) return false;
    if (e.key !== "Enter") return false;
    if (e.key === "Enter" && (e.nativeEvent.isComposing || isComposing.current))
      return false;
    return (
      (config.submitKey === SubmitKey.AltEnter && e.altKey) ||
      (config.submitKey === SubmitKey.CtrlEnter && e.ctrlKey) ||
      (config.submitKey === SubmitKey.ShiftEnter && e.shiftKey) ||
      (config.submitKey === SubmitKey.MetaEnter && e.metaKey) ||
      (config.submitKey === SubmitKey.Enter &&
        !e.altKey &&
        !e.ctrlKey &&
        !e.shiftKey &&
        !e.metaKey)
    );
  };

  return {
    submitKey,
    shouldSubmit,
  };
}

export type RenderPompt = Pick<Prompt, "title" | "content">;

export function PromptHints(props: {
  prompts: RenderPompt[];
  onPromptSelect: (prompt: RenderPompt) => void;
}) {
  const noPrompts = props.prompts.length === 0;
  const [selectIndex, setSelectIndex] = useState(0);
  const selectedRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setSelectIndex(0);
  }, [props.prompts.length]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (noPrompts || e.metaKey || e.altKey || e.ctrlKey) {
        return;
      }
      // arrow up / down to select prompt
      const changeIndex = (delta: number) => {
        e.stopPropagation();
        e.preventDefault();
        const nextIndex = Math.max(
          0,
          Math.min(props.prompts.length - 1, selectIndex + delta),
        );
        setSelectIndex(nextIndex);
        selectedRef.current?.scrollIntoView({
          block: "center",
        });
      };

      if (e.key === "ArrowUp") {
        changeIndex(1);
      } else if (e.key === "ArrowDown") {
        changeIndex(-1);
      } else if (e.key === "Enter") {
        const selectedPrompt = props.prompts.at(selectIndex);
        if (selectedPrompt) {
          props.onPromptSelect(selectedPrompt);
        }
      }
    };

    window.addEventListener("keydown", onKeyDown);

    return () => window.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.prompts.length, selectIndex]);

  if (noPrompts) return null;
  return (
    <div className={styles["prompt-hints"]}>
      {props.prompts.map((prompt, i) => (
        <div
          ref={i === selectIndex ? selectedRef : null}
          className={
            styles["prompt-hint"] +
            ` ${i === selectIndex ? styles["prompt-hint-selected"] : ""}`
          }
          key={prompt.title + i.toString()}
          onClick={() => props.onPromptSelect(prompt)}
          onMouseEnter={() => setSelectIndex(i)}
        >
          <div className={styles["hint-title"]}>{prompt.title}</div>
          <div className={styles["hint-content"]}>{prompt.content}</div>
        </div>
      ))}
    </div>
  );
}

function ClearContextDivider() {
  const chatStore = useChatStore();

  return (
    <div
      className={styles["clear-context"]}
      onClick={() =>
        chatStore.updateCurrentSession(
          (session) => (session.clearContextIndex = undefined),
        )
      }
    >
      <div className={styles["clear-context-tips"]}>{Locale.Context.Clear}</div>
      <div className={styles["clear-context-revert-btn"]}>
        {Locale.Context.Revert}
      </div>
    </div>
  );
}

function ChatAction(props: {
  text?: string;
  icon: JSX.Element;
  onClick: () => void;
  expand?: boolean;
}) {
  const iconRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState({
    full: 16,
    icon: 16,
  });

  function updateWidth() {
    if (!iconRef.current || !textRef.current) return;
    const getWidth = (dom: HTMLDivElement) => dom.getBoundingClientRect().width;
    const textWidth = getWidth(textRef.current);
    const iconWidth = getWidth(iconRef.current);
    setWidth({
      full: textWidth + iconWidth,
      icon: iconWidth,
    });
  }

  useEffect(() => {
    if (props.expand) {
      setTimeout(updateWidth, 1);
    }
  }, [props.expand]);

  return (
    <div
      className={`${styles["chat-input-action"]} clickable`}
      onClick={() => {
        props.onClick();
        setTimeout(updateWidth, 1);
      }}
      onMouseEnter={updateWidth}
      onTouchStart={updateWidth}
      style={
        {
          "--icon-width": `${width.icon}px`,
          "--full-width": `${width.full}px`,
        } as React.CSSProperties
      }
    >
      <div ref={iconRef} className={styles["icon"]}>
        {props.icon}
      </div>
      {props.text && (
        <div className={styles["text"]} ref={textRef}>
          {props.text}
        </div>
      )}
    </div>
  );
}

function useScrollToBottom(
  scrollRef: RefObject<HTMLDivElement>,
  detach: boolean = false,
) {
  // for auto-scroll

  const [autoScroll, setAutoScroll] = useState(true);
  function scrollDomToBottom() {
    const dom = scrollRef.current;
    if (dom) {
      requestAnimationFrame(() => {
        setAutoScroll(true);
        dom.scrollTo(0, dom.scrollHeight);
      });
    }
  }

  // auto scroll
  useEffect(() => {
    if (autoScroll && !detach) {
      scrollDomToBottom();
    }
  });

  return {
    scrollRef,
    autoScroll,
    setAutoScroll,
    scrollDomToBottom,
  };
}

export function ChatActions(props: {
  uploadImage: () => void;
  clearImages: () => void;
  showPromptModal: () => void;
  scrollToBottom: () => void;
  showPromptHints: () => void;
  hitBottom: boolean;
  uploading: boolean;
  setShowFeedback: (_: boolean) => void;
}) {
  const config = useAppConfig();
  const navigate = useNavigate();
  const chatStore = useChatStore();

  // switch themes
  const theme = config.theme;
  function nextTheme() {
    const themes = [Theme.Auto, Theme.Light, Theme.Dark];
    const themeIndex = themes.indexOf(theme);
    const nextIndex = (themeIndex + 1) % themes.length;
    const nextTheme = themes[nextIndex];
    config.update((config) => (config.theme = nextTheme));
  }

  // stop all responses
  const couldStop = ChatControllerPool.hasPending();
  const stopAll = () => ChatControllerPool.stopAll();

  // switch model
  const currentModel = chatStore.currentSession().mask.modelConfig.model;
  const allModels = useAllModels();
  const models = useMemo(() => {
    const filteredModels = allModels.filter((m) => m.available);
    const defaultModel = filteredModels.find((m) => m.isDefault);

    if (defaultModel) {
      const arr = [
        defaultModel,
        ...filteredModels.filter((m) => m !== defaultModel),
      ];
      return arr;
    } else {
      return filteredModels;
    }
  }, [allModels]);
  const [showModelSelector, setShowModelSelector] = useState(false);

  const [isLocalhost, setIsLocalhost] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      //TODO later add ".beta"
      const hostname = window.location.hostname;
      if (
        hostname === "localhost" ||
        hostname === "127.0.0.1" ||
        hostname === "::1"
      ) {
        setIsLocalhost(true);
      }
    }
  }, []);

  useEffect(() => {
    const show = isVisionModel(currentModel);
    if (!show) {
      props.clearImages();
    }

    // if current model is not available
    // switch to first available model
    const isUnavaliableModel = !models.some((m) => m.name === currentModel);
    if (isUnavaliableModel && models.length > 0) {
      // show next model to default model if exist
      let nextModel: ModelType = (
        models.find((model) => model.isDefault) || models[0]
      ).name;
      chatStore.updateCurrentSession(
        (session) => (session.mask.modelConfig.model = nextModel),
      );
      showToast(nextModel);
    }
  }, [chatStore, currentModel, models]);

  return (
    <div className={styles["chat-input-actions"]}>
      <DbcSettings />
      {env.DISABLE_FEEDBACK ? (
        ""
      ) : (
        <IconButton
          className={styles.feedback}
          text={Locale.Chat.InputActions.Feedback}
          // icon={<EmailIcon />}
          key="feedback"
          onClick={() => {
            //   props.onClose();
            props.setShowFeedback(true);
          }}
        />
      )}
      {couldStop && (
        <ChatAction
          onClick={stopAll}
          text={Locale.Chat.InputActions.Stop}
          icon={<StopIcon />}
        />
      )}
      {!props.hitBottom && (
        <ChatAction
          onClick={props.scrollToBottom}
          text={Locale.Chat.InputActions.ToBottom}
          icon={<BottomIcon />}
        />
      )}
      {/* {props.hitBottom && (
        <ChatAction
          onClick={props.showPromptModal}
          text={Locale.Chat.InputActions.Settings}
          icon={<SettingsIcon />}
        />
      )} */}

      {/* <ChatAction
      className={styles["theme-action"]}
        onClick={nextTheme}
        text={Locale.Chat.InputActions.Theme[theme]}
        icon={
          <>
            {theme === Theme.Auto ? (
              <AutoIcon />
            ) : theme === Theme.Light ? (
              <LightIcon />
            ) : theme === Theme.Dark ? (
              <DarkIcon />
            ) : null}
          </>
        }
      /> */}

      {/* <ChatAction
        onClick={props.showPromptHints}
        text={Locale.Chat.InputActions.Prompt}
        icon={<PromptIcon />}
      /> */}

      {/* <ChatAction
        onClick={() => {
          navigate(Path.Masks);
        }}
        text={Locale.Chat.InputActions.Masks}
        icon={<MaskIcon />}
      /> */}
      {/* 
      <ChatAction
        text={Locale.Chat.InputActions.Clear}
        icon={<BreakIcon />}
        onClick={() => {
          chatStore.updateCurrentSession((session) => {
            if (session.clearContextIndex === session.messages.length) {
              session.clearContextIndex = undefined;
            } else {
              session.clearContextIndex = session.messages.length;
              session.memoryPrompt = ""; // will clear memory
            }
          });
        }}
      /> */}

      {isLocalhost && (
        <ChatAction
          onClick={() => setShowModelSelector(true)}
          text={currentModel}
          icon={<RobotIcon />}
        />
      )}

      {showModelSelector && (
        <Selector
          defaultSelectedValue={currentModel}
          items={models.map((m) => ({
            title: m.displayName,
            value: m.name,
          }))}
          onClose={() => setShowModelSelector(false)}
          onSelection={(s) => {
            if (s.length === 0) return;
            chatStore.updateCurrentSession((session) => {
              session.mask.modelConfig.model = s[0] as ModelType;
              session.mask.syncGlobalConfig = false;
            });
            showToast(s[0]);
          }}
        />
      )}
    </div>
  );
}

export function EditMessageModal(props: { onClose: () => void }) {
  const chatStore = useChatStore();
  const session = chatStore.currentSession();
  const [messages, setMessages] = useState(session.messages.slice());
  // Ids present when the editor opened. New messages will not be in here.
  const [originalIds] = useState(
    () => new Set(session.messages.map((message) => message.id)),
  );

  return (
    <div className="modal-mask">
      <Modal
        title={Locale.Chat.EditMessage.Title}
        onClose={props.onClose}
        actions={[
          <IconButton
            text={Locale.UI.Cancel}
            icon={<CancelIcon />}
            key="cancel"
            onClick={() => {
              props.onClose();
            }}
          />,
          <IconButton
            type="primary"
            text={Locale.UI.Confirm}
            icon={<ConfirmIcon />}
            key="ok"
            onClick={() => {
              chatStore.updateCurrentSession((session) => {
                // A question and its answer can arrive while this editor is open.
                // Keep those new messages so pressing OK does not delete them.
                const added = session.messages.filter(
                  (message) => !originalIds.has(message.id),
                );
                session.messages = messages.concat(added);
              });
              props.onClose();
            }}
          />,
        ]}
      >
        <List>
          <ListItem
            title={Locale.Chat.EditMessage.Topic.Title}
            subTitle={Locale.Chat.EditMessage.Topic.SubTitle}
          >
            <input
              type="text"
              value={session.topic}
              onInput={(e) =>
                chatStore.updateCurrentSession(
                  (session) => (session.topic = e.currentTarget.value),
                )
              }
            ></input>
          </ListItem>
        </List>
        <ContextPrompts
          context={messages}
          updateContext={(updater) => {
            const newMessages = messages.slice();
            updater(newMessages);
            setMessages(newMessages);
          }}
        />
      </Modal>
    </div>
  );
}

// Short label for a file, e.g. "PDF" or "TXT".
function fileTypeLabel(file: { mime: string; name: string }): string {
  if (file.mime === "application/pdf") return "PDF";
  const ext = (file.name.split(".").pop() || "").toUpperCase();
  return ext.slice(0, 4) || "FIL";
}

function pdfCoverageWarnings(
  files: FileAttachment[],
  coverage: AttachmentCoverage,
): string[] {
  // One entry per file so the positions match. No warning gives "".
  return files.map((file, index) => {
    if (!file.pdfPageCount) return "";
    const pages = coverage.files[index]?.images ?? 0;
    if (pages >= file.pdfPageCount) return "";
    return pages > 0
      ? `${file.name}: SkoleGPT kan kun se de første ${pages} af ${file.pdfPageCount} sider.`
      : `${file.name}: SkoleGPT kan ikke se nogen sider fra filen. Fjern andre vedhæftninger for at få plads.`;
  });
}

// Opens what the server said, so it can go in a fault report.
function ErrorInfo(props: { info: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        className={styles["chat-message-error-info"]}
        title={Locale.Chat.NoResponse.ShowInfo}
        aria-label={Locale.Chat.NoResponse.ShowInfo}
        onClick={() => setOpen(!open)}
      >
        <InfoIcon />
      </button>
      {open && (
        <div className={styles["chat-message-error-code"]}>
          <span className={styles["chat-message-error-code-label"]}>
            {Locale.Chat.NoResponse.InfoLabel}
          </span>{" "}
          {props.info}
        </div>
      )}
    </>
  );
}

function _Chat() {
  type RenderMessage = ChatMessage & { preview?: boolean };

  const chatStore = useChatStore();
  const session = chatStore.currentSession();
  const config = useAppConfig();
  const fontSize = config.fontSize;
  // attachments are only turned on for SkoleGPT, and only on models that can
  // read them. other apps never see the attach button, drag-drop or paste.
  const canAttach =
    !!env.ENABLE_ATTACHMENTS && isVisionModel(session.mask.modelConfig.model);

  // This reads new chat answers out loud by itself, but only for skolegpt,
  // and only once the user turns on the auto read button in the chat
  // header. All the play buttons in this chat share the same tts object
  // below, so only the button for the answer that is playing lights up.
  const autoTts = config.autoTts;
  const tts = useTts();
  const { speak: speakTts, stop: stopTts } = tts;
  const lastSpokenIdRef = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    if (!env.ENABLE_TTSASR) return;

    const messages = session.messages;
    const last = messages[messages.length - 1];
    const lastId = last?.id ?? null;

    // First time this runs for a chat, just remember the last message. That
    // way we do not read an old answer that was already there when you opened it.
    if (lastSpokenIdRef.current === undefined) {
      lastSpokenIdRef.current = lastId;
      return;
    }

    // Only read a brand new answer once it has finished loading.
    if (
      !last ||
      last.role !== MessageRole.Assistant ||
      last.streaming ||
      last.isError ||
      lastId === lastSpokenIdRef.current
    )
      return;

    lastSpokenIdRef.current = lastId;

    if (autoTts) {
      const text = getMessageTextContent(last);
      if (text.trim()) void speakTts(text, lastId);
    }
  }, [session.messages, autoTts, speakTts]);

  const [showExport, setShowExport] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);

  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [userInput, setUserInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { submitKey, shouldSubmit } = useSubmitHandler();
  const scrollRef = useRef<HTMLDivElement>(null);
  const isScrolledToBottom = scrollRef?.current
    ? Math.abs(
        scrollRef.current.scrollHeight -
          (scrollRef.current.scrollTop + scrollRef.current.clientHeight),
      ) <= 1
    : false;
  const { setAutoScroll, scrollDomToBottom } = useScrollToBottom(
    scrollRef,
    isScrolledToBottom,
  );
  // Measure the input box so the message list can leave enough empty space below
  // the last message. The input box gets taller when files/images are attached
  // (or when you type more lines), and would otherwise cover the last answer.
  const inputPanelRef = useRef<HTMLDivElement>(null);
  const [inputPanelHeight, setInputPanelHeight] = useState(0);
  useEffect(() => {
    const el = inputPanelRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setInputPanelHeight(entry.contentRect.height);
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  // When the input box changes size, keep the newest message above it - but only
  // if you're already at the bottom, so we don't jump you around if you scrolled up.
  useEffect(() => {
    const dom = scrollRef.current;
    if (!dom) return;
    const distanceFromBottom =
      dom.scrollHeight - (dom.scrollTop + dom.clientHeight);
    if (distanceFromBottom <= inputPanelHeight + 80) {
      scrollDomToBottom();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inputPanelHeight]);
  const [hitBottom, setHitBottom] = useState(true);
  const isMobileScreen = useMobileScreen();
  const navigate = useNavigate();
  const [attachments, setAttachments] = useState({
    images: [] as string[],
    imageNames: [] as string[],
    files: [] as FileAttachment[],
  });
  const attachmentsRef = useRef(attachments);
  const {
    images: attachImages,
    imageNames: attachImageNames,
    files: attachFiles,
  } = attachments;
  // Set the ref right away so uploads and removals see each other's changes.
  function updateAttachments(next: typeof attachments) {
    attachmentsRef.current = next;
    setAttachments(next);
  }
  const uploadQueue = useRef(Promise.resolve());
  const reading = useRef(0);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      // In development React runs this cleanup and then mounts again. Wait a
      // moment and only delete the draft's files if the chat is really closed.
      queueMicrotask(() => {
        if (mounted.current) return;
        for (const file of attachmentsRef.current.files) {
          if (file.id) void deleteFileBlob(file.id);
        }
      });
    };
  }, []);
  const [uploading, setUploading] = useState(false);
  const [attachmentNotice, setAttachmentNotice] = useState<{
    source: typeof attachments;
    messages: string[];
    error?: string;
  }>();
  useEffect(() => {
    if (!attachments.files.some((file) => file.pdfPageCount)) {
      setAttachmentNotice(undefined);
      return;
    }
    if (env.APP !== "skolegpt" || uploading) return;
    // Count again when a file or picture is added or removed. That changes how
    // many PDF pages fit. An old count must not be shown for a newer draft.
    const coverage = getAttachmentCoverage(
      attachments.files,
      attachments.images.map(imageTokensFromUrl),
    );
    setAttachmentNotice({
      source: attachments,
      messages: pdfCoverageWarnings(attachments.files, coverage),
    });
  }, [attachments, uploading]);
  const [isDragging, setIsDragging] = useState(false);
  const [viewerAttachment, setViewerAttachment] =
    useState<FileAttachment | null>(null);
  // The link the viewer shows for the open file and whether that file is a
  // PDF. Both are set together. So the sandbox setting of one file is never
  // used with the link of another.
  const [viewer, setViewer] = useState({ url: "", isPdf: false });
  useEffect(() => {
    setViewer({ url: "", isPdf: false });
    // a Word file is shown as its text so the saved file is not needed
    if (!viewerAttachment || viewerAttachment.mime === DOCX_MIME) return;
    const { url, id, mime } = viewerAttachment;
    // only open data and blob links. Never a link to another site
    if (url && !/^(data|blob):/.test(url)) return;
    // a picture is shown with <img> and that cannot run code
    if (url && mime.startsWith("image/")) {
      setViewer({ url, isPdf: false });
      return;
    }
    let objectUrl = "";
    let cancelled = false;
    const load = url
      ? fetch(url).then((response) => response.blob())
      : id
        ? loadFileBlob(id)
        : Promise.resolve(null);
    load
      .then((blob) => {
        if (cancelled || !blob) return;
        // Besides PDF and Word the app only takes text files. So anything
        // that is not a PDF is shown as plain text. A csv file with its own
        // type would be downloaded and the sandbox blocks that. An imported
        // assistant can label an html file as a PDF. It is then served as a
        // PDF and cannot run as a web page.
        const isPdf = mime === "application/pdf";
        const type = isPdf ? "application/pdf" : "text/plain;charset=utf-8";
        objectUrl = URL.createObjectURL(blob.slice(0, blob.size, type));
        setViewer({ url: objectUrl, isPdf });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [viewerAttachment]);
  const openImageViewer = (url: string, name = "") =>
    setViewerAttachment({ url, name, mime: "image/*" });
  const [childInputs, setChildInputs] = useState<Record<string, string>>({});
  const [multiViewMode, setMultiViewMode] = useState<"grid" | "tabs">("grid");
  const [selectedChildId, setSelectedChildId] = useState<string | undefined>();

  // prompt hints
  const promptStore = usePromptStore();
  const [promptHints, setPromptHints] = useState<RenderPompt[]>([]);
  const onSearch = useDebouncedCallback(
    (text: string) => {
      const matchedPrompts = promptStore.search(text);
      setPromptHints(matchedPrompts);
    },
    100,
    { leading: true, trailing: true },
  );

  // INPUT_HINTS_ON_CLICK: the placeholder shows the keyboard shortcuts once the
  // field is clicked. Not on focus, since the field gets focus on page load.
  const [showInputHints, setShowInputHints] = useState(false);
  let inputPlaceholder = Locale.Chat.Input(submitKey);
  if (env.INPUT_HINTS_ON_CLICK) {
    const keyboardHints = [
      `${submitKey} sender`,
      submitKey === SubmitKey.Enter && "Shift + Enter ny linje",
      "/ søg i prompts",
    ];
    inputPlaceholder = showInputHints
      ? keyboardHints.filter(Boolean).join(" · ")
      : `Spørg ${env.APP_TITLE}`;
  }

  // auto grow input
  const [inputRows, setInputRows] = useState(1);
  const measure = useDebouncedCallback(
    () => {
      const rows = inputRef.current ? autoGrowTextArea(inputRef.current) : 1;
      const inputRows = Math.min(
        20,
        Math.max(2 + Number(!isMobileScreen), rows),
      );
      // setInputRows(inputRows);
    },
    100,
    {
      leading: true,
      trailing: true,
    },
  );

  // switch themes
  const theme = config.theme;
  function nextTheme() {
    const themes = [Theme.Light, Theme.Dark]; //Theme.Auto,
    const themeIndex = themes.indexOf(theme);
    const nextIndex = (themeIndex + 1) % themes.length;
    const nextTheme = themes[nextIndex];
    config.update((config) => (config.theme = nextTheme));
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(measure, [userInput]);

  // Initialize selected child when multi children appear
  useEffect(() => {
    if (
      session.multiLlmChildren &&
      session.multiLlmChildren.length > 0 &&
      !selectedChildId
    ) {
      setSelectedChildId(session.multiLlmChildren[0].id);
    }
  }, [session.multiLlmChildren, selectedChildId]);

  // In multi-LLM mode, start at top and do not auto-scroll
  useEffect(() => {
    const multi =
      session.multiLlmChildren && session.multiLlmChildren.length > 0;
    if (multi) {
      setAutoScroll(false);
      requestAnimationFrame(() => {
        scrollRef.current?.scrollTo(0, 0);
      });
    }
  }, [session.multiLlmChildren, setAutoScroll]);

  // chat commands shortcuts
  const chatCommands = useChatCommand({
    new: () => chatStore.newSession(),
    newm: () => navigate(Path.NewChat),
    prev: () => chatStore.nextSession(-1),
    next: () => chatStore.nextSession(1),
    clear: () =>
      chatStore.updateCurrentSession(
        (session) => (session.clearContextIndex = session.messages.length),
      ),
    del: () => chatStore.deleteSession(chatStore.currentSessionIndex),
  });

  // only search prompts when user input is short
  const SEARCH_TEXT_LIMIT = 30;
  const onInput = (text: string) => {
    setUserInput(text);
    const n = text.trim().length;

    // clear search results
    if (n === 0) {
      setPromptHints([]);
    } else if (text.startsWith(ChatCommandPrefix)) {
      setPromptHints(chatCommands.search(text));
    } else if (!config.disablePromptHint && n < SEARCH_TEXT_LIMIT) {
      // check if need to trigger auto completion
      if (text.startsWith("/")) {
        let searchText = text.slice(1);
        onSearch(searchText);
      }
    }
  };

  const doSubmit = (userInput: string) => {
    const {
      images: attachImages,
      imageNames: attachImageNames,
      files: attachFiles,
    } = attachmentsRef.current;
    if (
      userInput.trim() === "" &&
      attachImages.length === 0 &&
      attachFiles.length === 0
    )
      return;
    // A file that is still being read would miss this message and be sent
    // with the next one. So the pupil has to wait for it.
    if (reading.current > 0) {
      showToast("Vent til filen er læst ind, og send så igen.");
      return;
    }
    const matchCommand = chatCommands.match(userInput);
    if (matchCommand.matched) {
      setUserInput("");
      setPromptHints([]);
      matchCommand.invoke();
      return;
    }
    setIsLoading(true);
    const isMulti =
      session.multiLlmChildren && session.multiLlmChildren.length > 0;
    let p: any;
    if (isMulti) {
      if (multiViewMode === "tabs" && selectedChildId) {
        p = chatStore.onUserInputToChild?.(
          selectedChildId,
          userInput,
          attachImages,
        );
      } else {
        p = chatStore.onUserInputSmart(userInput, attachImages);
      }
    } else {
      p = chatStore.onUserInput(
        userInput,
        attachImages,
        attachFiles,
        attachImageNames,
      );
    }
    Promise.resolve(p).then(() => setIsLoading(false));
    updateAttachments({ images: [], imageNames: [], files: [] });
    localStorage.setItem(LAST_INPUT_KEY, userInput);
    setUserInput("");
    setPromptHints([]);
    if (!isMobileScreen) inputRef.current?.focus();
    if (!isMulti) {
      setAutoScroll(true);
    } else {
      setAutoScroll(false);
    }
    // Skip Matomo tracking in multi-llm mode
    if (!isMulti) {
      const modelName = session?.mask?.name;
      trackMatomoEvent("Chat", "Send message", modelName);
    }
  };

  const onPromptSelect = (prompt: RenderPompt) => {
    setTimeout(() => {
      setPromptHints([]);

      const matchedChatCommand = chatCommands.match(prompt.content);
      if (matchedChatCommand.matched) {
        // if user is selecting a chat command, just trigger it
        matchedChatCommand.invoke();
        setUserInput("");
      } else {
        // or fill the prompt
        setUserInput(prompt.content);
      }
      inputRef.current?.focus();
    }, 30);
  };

  const setChildInput = useCallback((childId: string, value: string) => {
    setChildInputs((prev) => ({ ...prev, [childId]: value }));
  }, []);

  const doChildSubmit = useCallback(
    (childId: string) => {
      const text = (childInputs[childId] || "").trim();
      if (text.length === 0) return;
      chatStore.onUserInputToChild?.(childId, text);
      setChildInput(childId, "");
    },
    [chatStore, childInputs, scrollDomToBottom, setAutoScroll, setChildInput],
  );

  // stop response
  const onUserStop = (messageId: string) => {
    ChatControllerPool.stop(session.id, messageId);
  };

  useEffect(() => {
    chatStore.updateCurrentSession((session) => {
      const stopTiming = Date.now() - REQUEST_TIMEOUT_MS;
      session.messages.forEach((m) => {
        if (m.retrying) {
          // Still trying in the background after the user went to another
          // chat and came back. Leave it alone.
          const key = ChatControllerPool.key(session.id, m.id);
          if (ChatControllerPool.controllers[key]) return;

          // A try only runs while the page is open, so this one was cut off.
          m.retrying = false;
          m.streaming = false;
          m.isError = true;
          m.content = Locale.Chat.NoResponse.Failed;
        }

        // check if should stop all stale messages
        if (m.isError || new Date(m.date).getTime() < stopTiming) {
          if (m.streaming) {
            m.streaming = false;
          }

          if (m.content.length === 0) {
            m.isError = true;
            m.content = Locale.Chat.NoResponse.Failed;
          }
        }
      });

      // auto sync mask config from global config
      if (session.mask.syncGlobalConfig) {
        session.mask.modelConfig = { ...config.modelConfig };
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // check if should send message
  const onInputKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // if ArrowUp and no userInput, fill with last input
    if (
      e.key === "ArrowUp" &&
      userInput.length <= 0 &&
      !(e.metaKey || e.altKey || e.ctrlKey)
    ) {
      setUserInput(localStorage.getItem(LAST_INPUT_KEY) ?? "");
      e.preventDefault();
      return;
    }
    if (shouldSubmit(e) && promptHints.length === 0) {
      doSubmit(userInput);
      e.preventDefault();
    }
  };
  const onRightClick = (e: any, message: ChatMessage) => {
    // copy to clipboard
    if (selectOrCopy(e.currentTarget, getMessageTextContent(message))) {
      if (userInput.length === 0) {
        setUserInput(getMessageTextContent(message));
      }

      e.preventDefault();
    }
  };

  const deleteMessage = (msgId?: string) => {
    chatStore.updateCurrentSession(
      (session) =>
        (session.messages = session.messages.filter((m) => m.id !== msgId)),
    );
  };

  const onDelete = (msgId: string) => {
    deleteMessage(msgId);
  };

  const onResend = (message: ChatMessage) => {
    // when it is resending a message
    // 1. for a user's message, find the next bot response
    // 2. for a bot's message, find the last user's input
    // 3. delete original user input and bot's message
    // 4. resend the user's input

    const resendingIndex = session.messages.findIndex(
      (m) => m.id === message.id,
    );

    if (resendingIndex < 0 || resendingIndex >= session.messages.length) {
      console.error("[Chat] failed to find resending message", message);
      return;
    }

    let userMessage: ChatMessage | undefined;
    let botMessage: ChatMessage | undefined;

    if (message.role === "assistant") {
      // if it is resending a bot's message, find the user input for it
      botMessage = message;
      for (let i = resendingIndex; i >= 0; i -= 1) {
        if (session.messages[i].role === "user") {
          userMessage = session.messages[i];
          break;
        }
      }
    } else if (message.role === "user") {
      // if it is resending a user's input, find the bot's response
      userMessage = message;
      for (let i = resendingIndex; i < session.messages.length; i += 1) {
        if (session.messages[i].role === "assistant") {
          botMessage = session.messages[i];
          break;
        }
      }
    }

    if (userMessage === undefined) {
      console.error("[Chat] failed to resend", message);
      return;
    }

    // delete the original messages
    deleteMessage(userMessage.id);
    deleteMessage(botMessage?.id);

    // resend the message
    setIsLoading(true);
    const textContent = getMessageTextContent(userMessage);
    const images = getMessageImages(userMessage);
    const imageNames = getMessageImageNames(userMessage);
    // Without the files the model answers about a document it never got.
    chatStore
      .onUserInput(textContent, images, getMessageFiles(userMessage), imageNames)
      .then(() => setIsLoading(false));
    inputRef.current?.focus();
  };

  const onPinMessage = (message: ChatMessage) => {
    chatStore.updateCurrentSession((session) =>
      session.mask.context.push(message),
    );

    showToast(Locale.Chat.Actions.PinToastContent, {
      text: Locale.Chat.Actions.PinToastAction,
      onClick: () => {
        setShowPromptModal(true);
      },
    });
  };

  const context: RenderMessage[] = useMemo(() => {
    return session.mask.hideContext ? [] : session.mask.context.slice();
  }, [session.mask.context, session.mask.hideContext]);
  const accessStore = useAccessStore();

  if (
    !env.DISABLE_BOT_HELLO &&
    context.length === 0 &&
    session.messages.at(0)?.content !== BOT_HELLO.content
  ) {
    const copiedHello = Object.assign({}, BOT_HELLO);
    if (!accessStore.isAuthorized()) {
      // copiedHello.content = Locale.Error.Unauthorized;
    }
    context.push(copiedHello);
  }
  // preview messages
  const renderMessages = useMemo(() => {
    return context.concat(session.messages as RenderMessage[]).concat(
      isLoading
        ? [
            {
              ...createMessage({
                role: MessageRole.Assistant,
                content: "……",
              }),
              preview: true,
            },
          ]
        : [],
    );
  }, [
    config.sendPreviewBubble,
    context,
    isLoading,
    session.messages,
    userInput,
  ]);

  const [msgRenderIndex, _setMsgRenderIndex] = useState(
    Math.max(0, renderMessages.length - CHAT_PAGE_SIZE),
  );
  function setMsgRenderIndex(newIndex: number) {
    newIndex = Math.min(renderMessages.length - CHAT_PAGE_SIZE, newIndex);
    newIndex = Math.max(0, newIndex);
    _setMsgRenderIndex(newIndex);
  }

  const messages = useMemo(() => {
    const endRenderIndex = Math.min(
      msgRenderIndex + 3 * CHAT_PAGE_SIZE,
      renderMessages.length,
    );
    return renderMessages.slice(msgRenderIndex, endRenderIndex);
  }, [msgRenderIndex, renderMessages]);

  const hasMalicious = useMemo(() => {
    const isMalicious = (m: any) =>
      typeof m?.content === "string" && m.content.trim() === MALICIOUS_ANSWER;

    // Check visible main messages (same behavior as before).
    if (messages.some(isMalicious)) return true;

    // In multi-LLM / multi-agent mode, also check child panes.
    const children = session.multiLlmChildren ?? [];
    return children.some((child) => (child.messages ?? []).some(isMalicious));
  }, [messages, session.multiLlmChildren]);

  const onChatBodyScroll = (e: HTMLElement) => {
    const bottomHeight = e.scrollTop + e.clientHeight;
    const edgeThreshold = e.clientHeight;

    const isTouchTopEdge = e.scrollTop <= edgeThreshold;
    const isTouchBottomEdge = bottomHeight >= e.scrollHeight - edgeThreshold;
    const isHitBottom =
      bottomHeight >= e.scrollHeight - (isMobileScreen ? 4 : 10);

    const prevPageMsgIndex = msgRenderIndex - CHAT_PAGE_SIZE;
    const nextPageMsgIndex = msgRenderIndex + CHAT_PAGE_SIZE;

    if (isTouchTopEdge && !isTouchBottomEdge) {
      setMsgRenderIndex(prevPageMsgIndex);
    } else if (isTouchBottomEdge) {
      setMsgRenderIndex(nextPageMsgIndex);
    }

    setHitBottom(isHitBottom);
    setAutoScroll(isHitBottom);
  };
  function scrollToBottom() {
    setMsgRenderIndex(renderMessages.length - CHAT_PAGE_SIZE);
    scrollDomToBottom();
  }

  // clear context index = context length + index in messages
  const clearContextIndex =
    (session.clearContextIndex ?? -1) >= 0
      ? session.clearContextIndex! + context.length - msgRenderIndex
      : -1;

  const [showPromptModal, setShowPromptModal] = useState(false);

  const clientConfig = useMemo(() => getClientConfig(), []);

  const autoFocus = !isMobileScreen; // wont auto focus on mobile screen
  const showMaxIcon = !isMobileScreen && !clientConfig?.isApp;

  useCommand({
    fill: setUserInput,
    submit: (text) => {
      doSubmit(text);
    },
    newchat: (text) => {
      if (text.trim() === "") return;
      // Always start a fresh conversation. Used by the skolegpt.dk landing
      // chatbox so a returning visitor's message never lands in their old chat.
      chatStore.newSession();
      setIsLoading(true);
      chatStore.onUserInput(text).then(() => setIsLoading(false));
      setAutoScroll(true);
    },
    code: (text) => {
      if (accessStore.disableFastLink) return;
      console.log("[Command] got code from url: ", text);
      showConfirm(Locale.URLCommand.Code + `code = ${text}`).then((res) => {
        if (res) {
          accessStore.update((access) => (access.accessCode = text));
        }
      });
    },
    settings: (text) => {
      if (accessStore.disableFastLink) return;

      try {
        const payload = JSON.parse(text) as {
          key?: string;
          url?: string;
        };

        console.log("[Command] got settings from url: ", payload);

        if (payload.key || payload.url) {
          showConfirm(
            Locale.URLCommand.Settings +
              `\n${JSON.stringify(payload, null, 4)}`,
          ).then((res) => {
            if (!res) return;
            if (payload.key) {
              accessStore.update(
                (access) => (access.openaiApiKey = payload.key!),
              );
            }
            if (payload.url) {
              accessStore.update((access) => (access.openaiUrl = payload.url!));
            }
            accessStore.update((access) => (access.useCustomConfig = true));
          });
        }
      } catch {
        console.error("[Command] failed to get settings from url: ", text);
      }
    },
  });

  // edit / insert message modal
  const [isEditingMessage, setIsEditingMessage] = useState(false);

  // remember unfinished input
  useEffect(() => {
    // try to load from local storage
    const key = UNFINISHED_INPUT(session.id);
    const mayBeUnfinishedInput = localStorage.getItem(key);
    if (mayBeUnfinishedInput && userInput.length === 0) {
      setUserInput(mayBeUnfinishedInput);
      localStorage.removeItem(key);
    }

    const dom = inputRef.current;
    return () => {
      localStorage.setItem(key, dom?.value ?? "");
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // when you paste image(s): collect them and send them through the same path
  // as the attach button and drag-and-drop
  function handlePaste(event: React.ClipboardEvent<HTMLTextAreaElement>) {
    if (!canAttach) return;
    const items =
      event.clipboardData?.items ?? (window as any).clipboardData?.items;
    if (!items) return;
    const files: File[] = [];
    for (const item of items) {
      if (item.kind === "file" && item.type.startsWith("image/")) {
        const file = item.getAsFile();
        if (file) files.push(file);
      }
    }
    if (files.length === 0) return;
    event.preventDefault();
    processFiles(files);
  }

  // A batch waits for the one before it so both cannot take the same room.
  async function processFiles(files: File[]) {
    const isCurrent = () => {
      const current = useChatStore.getState().currentSession();
      return (
        mounted.current &&
        current.id === session.id &&
        isVisionModel(current.mask.modelConfig.model)
      );
    };
    if (files.length === 0 || !isCurrent()) return;
    // A chat with several models only sends pictures. Leave documents out
    // here. Otherwise they would look attached and then be lost on send.
    let incoming = files;
    if (useChatStore.getState().currentSession().multiLlmChildren?.length) {
      incoming = files.filter(isImageFile);
      if (incoming.length < files.length)
        showToast(
          "Dokumenter kan ikke bruges i en chat med flere modeller. Du kan stadig vedhæfte billeder.",
        );
      if (incoming.length === 0) return;
    }
    const previous = uploadQueue.current;
    let release!: () => void;
    uploadQueue.current = new Promise<void>((resolve) => (release = resolve));
    reading.current += 1;
    setUploading(true);
    try {
      await previous;
      const problems: string[] = [];
      let skippedImages = 0;
      let skippedFiles = false;
      let fullDraft: typeof attachments | undefined;
      // Read pictures first so only successful uploads take room from the files.
      for (const file of [
        ...incoming.filter(isImageFile),
        ...incoming.filter((file) => !isImageFile(file)),
      ]) {
        if (!isCurrent()) return;
        let unattached: FileAttachment | undefined;
        // One file that cannot be read must not stop the others.
        try {
          if (isImageFile(file)) {
            if (attachmentsRef.current.images.length >= MAX_ATTACHED_IMAGES) {
              skippedImages += 1;
              continue;
            }
            const dataUrl = await compressImage(file, 256 * 1024);
            if (!isCurrent()) return;
            const current = attachmentsRef.current;
            updateAttachments({
              ...current,
              images: [...current.images, dataUrl],
              imageNames: [...current.imageNames, file.name || ""],
            });
          } else {
            let checked: typeof attachments;
            let full: boolean;
            checked = attachmentsRef.current;
            full =
              checked === fullDraft ||
              (env.APP === "skolegpt"
                ? isAttachmentBudgetFull(
                    checked.files,
                    checked.images.map(imageTokensFromUrl),
                  )
                : isAttachmentBudgetFull(checked.files, checked.images.length));
            if (!isCurrent()) return;
            if (full) {
              fullDraft = checked;
              skippedFiles = true;
              continue;
            }
            const result = await fileToAttachment(file);
            unattached = result;
            if (!isCurrent()) return;
            if (env.APP === "skolegpt") {
              checked = attachmentsRef.current;
              const coverage = getAttachmentCoverage(
                [...checked.files, result],
                checked.images.map(imageTokensFromUrl),
              );
              const included =
                coverage.files[checked.files.length]?.included ?? false;
              if (!included) {
                problems.push(
                  `${file.name} kunne ikke vedhæftes. Der er ikke plads til ${result.pdfPageCount ? "flere sider" : "filens indhold"}. Send de vedhæftede filer først, eller fjern en af dem.`,
                );
                continue;
              }
            }
            updateAttachments({
              ...attachmentsRef.current,
              files: [...attachmentsRef.current.files, result],
            });
            unattached = undefined;
            if (result.warning) problems.push(result.warning);
          }
        } catch (e: any) {
          problems.push(e?.message || "Kunne ikke vedhæfte filen.");
        } finally {
          // The file was saved before it was checked. If it did not get into
          // the draft then delete the saved file and its pictures again.
          if (unattached?.id) void deleteFileBlob(unattached.id);
        }
      }
      if (!isCurrent()) return;
      if (skippedFiles) {
        problems.push(
          "Der er ikke plads til flere filer. Send de vedhæftede først, eller fjern en af dem.",
        );
      }
      if (skippedImages > 0) {
        problems.push(Locale.Chat.TooManyImages(MAX_ATTACHED_IMAGES));
      }
      if (problems.length > 0) showToast(problems.join(" "), undefined, 9000);
    } finally {
      release();
      reading.current -= 1;
      if (mounted.current && reading.current === 0) setUploading(false);
    }
  }

  function uploadImage() {
    const fileInput = document.createElement("input");
    fileInput.type = "file";
    fileInput.accept =
      "image/png, image/jpeg, image/webp, image/heic, image/heif," +
      FILE_ACCEPT;
    fileInput.multiple = true;
    fileInput.onchange = (event: any) =>
      processFiles(Array.from(event.target.files || []));
    fileInput.click();
  }

  function onDropFiles(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);
    if (!canAttach) return;
    processFiles(Array.from(e.dataTransfer?.files || []));
  }

  const multiLlmStarted =
    session.multiLlmChildren && session.multiLlmChildren.length > 0;

  const isMultiLlm = !!multiLlmStarted && session.multiMode === "llm";
  const isMultiAgents = !!multiLlmStarted && session.multiMode === "agents";
  // when the attached files are shown, keep the attach/mic buttons at the
  // bottom (next to the text field) instead of at the top
  const hasAttachments = attachImages.length != 0 || attachFiles.length != 0;
  return (
    <div className={styles.chat} key={session.id}>
      <div
        className={`window-header ${styles.headerContainer}`}
        data-tauri-drag-region
      >
        {isMobileScreen && (
          <div className="window-actions">
            <div className={"window-action-button"}>
              <IconButton
                icon={<ReturnIcon />}
                bordered
                title={Locale.Chat.Actions.ChatList}
                onClick={() =>
                  navigate(`${Path.Chat}?showSideBar=true`, { replace: true })
                }
              />
            </div>
          </div>
        )}
        <div className={styles.topbarButtonContainer}>
          <ChatAction
            onClick={nextTheme}
            //  text={Locale.Chat.InputActions.Theme[theme]}
            icon={
              <>
                {theme === Theme.Auto ? (
                  <AutoIcon />
                ) : theme === Theme.Light ? (
                  <LightIcon />
                ) : theme === Theme.Dark ? (
                  <DarkIcon />
                ) : null}
              </>
            }
          />
          {env.ENABLE_TTSASR && (
            <IconButton
              className={styles.ttsToggleButton}
              icon={
                autoTts ? (
                  <SpeakerTtsIcon style={{ width: 16, height: 16 }} />
                ) : (
                  <SpeakerTtsOffIcon style={{ width: 16, height: 16 }} />
                )
              }
              title={
                autoTts
                  ? "Automatisk oplæsning er slået til"
                  : "Læs svar højt automatisk"
              }
              onClick={() => {
                const next = !autoTts;
                config.update((c) => (c.autoTts = next));
                if (!next) stopTts();
              }}
            />
          )}
          {!env.DISABLE_MULTI_LLM && !multiLlmStarted && (
            <IconButton
              icon={<PluginIcon />}
              //  bordered
              title={"Multi-llm"}
              onClick={() => {
                const ok = chatStore.startMultiLlm?.();
                if (!ok) {
                  showToast("Start a new empty chat to use Multi-llm");
                }
              }}
            />
          )}
          {!env.DISABLE_MULTI_LLM &&
            session.multiLlmChildren &&
            session.multiLlmChildren.length > 0 &&
            multiLlmStarted && (
              <IconButton
                icon={multiViewMode === "grid" ? <EyeIcon /> : <EyeIcon />}
                size={3}
                title={
                  multiViewMode === "grid"
                    ? "View: Grid (click to Tabs)"
                    : "View: Tabs (click to Grid)"
                }
                onClick={() =>
                  setMultiViewMode((m) => (m === "grid" ? "tabs" : "grid"))
                }
              />
            )}
          {true && (
            <IconButton
              icon={<ExportIcon />}
              title={Locale.Chat.Actions.Export}
              onClick={() => {
                setShowExport(true);
              }}
            />
          )}
        </div>

        {!isMobileScreen && (
          <div className={`window-header-title ${styles["chat-body-title"]}`}>
            <div
              className={`window-header-main-title ${styles["chat-body-main-title"]}`}
              onClickCapture={() => setIsEditingMessage(true)}
            >
              {env.SHOW_MASK_NAME_IN_HEADER
                ? session.mask.name
                : session.topic || DEFAULT_TOPIC}
            </div>
            <div className="window-header-sub-title">
              {Locale.Chat.SubTitle(session.messages.length)}
            </div>
          </div>
        )}
      </div>

      {/* <div className="window-header" data-tauri-drag-region>
        <ChatAction
          onClick={nextTheme}
          text={Locale.Chat.InputActions.Theme[theme]}
          icon={
            <>
              {theme === Theme.Auto ? (
                <AutoIcon />
              ) : theme === Theme.Light ? (
                <LightIcon />
              ) : theme === Theme.Dark ? (
                <DarkIcon />
              ) : null}
            </>
          }
        />
      </div> */}
      {
        // <div className="window-header" data-tauri-drag-region>
        //   {isMobileScreen && (
        //     <div className="window-actions">
        //       <div className={"window-action-button"}>
        //         <IconButton
        //           icon={<ReturnIcon />}
        //           bordered
        //           title={Locale.Chat.Actions.ChatList}
        //           onClick={() =>
        //             navigate(`${Path.Chat}?showSideBar=true`, { replace: true })
        //           }
        //         />
        //       </div>
        //     </div>
        //   )}
        //   <div className={`window-header-title ${styles["chat-body-title"]}`}>
        //     <div
        //       className={`window-header-main-title ${styles["chat-body-main-title"]}`}
        //       onClickCapture={() => setIsEditingMessage(true)}
        //     >
        //       {!session.topic ? DEFAULT_TOPIC : session.topic}
        //     </div>
        //     <div className="window-header-sub-title">
        //       {Locale.Chat.SubTitle(session.messages.length)}
        //     </div>
        //   </div>
        //   <div className="window-actions">
        //     {/* {!isMobileScreen && (
        //     <div className="window-action-button">
        //       <IconButton
        //         icon={<RenameIcon />}
        //         bordered
        //         onClick={() => setIsEditingMessage(true)}
        //       />
        //     </div>
        //   )} */}
        //     <div className="window-action-button">
        //       <IconButton
        //         icon={<ExportIcon />}
        //         bordered
        //         title={Locale.Chat.Actions.Export}
        //         onClick={() => {
        //           setShowExport(true);
        //         }}
        //       />
        //     </div>
        //     <div className="window-action-button">
        //       <IconButton
        //         icon={<SettingsIcon />}
        //         bordered
        //         title={Locale.Chat.Actions.Export}
        //         onClick={() => {
        //           navigate(Path.Settings);
        //           // to={Path.Settings}>
        //           // setShowExport(true);
        //         }}
        //       />
        //     </div>
        //     {/* {showMaxIcon && (
        //     <div className="window-action-button">
        //       <IconButton
        //         icon={config.tightBorder ? <MinIcon /> : <MaxIcon />}
        //         bordered
        //         onClick={() => {
        //           config.update(
        //             (config) => (config.tightBorder = !config.tightBorder),
        //           );
        //         }}
        //       />
        //     </div>
        //   )} */}
        //   </div>
        //   {/* <PromptToast
        //   showToast={!hitBottom}
        //   showModal={showPromptModal}
        //   setShowModal={setShowPromptModal}
        // /> */}
        // </div>
      }

      <div
        className={styles["chat-body"]}
        ref={scrollRef}
        onScroll={(e) => onChatBodyScroll(e.currentTarget)}
        onMouseDown={() => inputRef.current?.blur()}
        onTouchStart={() => {
          inputRef.current?.blur();
          setAutoScroll(false);
        }}
      >
        {/* Multi grid (LLM or Agents) if present */}
        {session.multiLlmChildren && session.multiLlmChildren.length > 0 ? (
          <div className={styles["multi-llm-container"]}>
            {multiViewMode === "tabs" && (
              <div className={styles["multi-llm-tabs"]}>
                {session.multiLlmChildren.map((child) => {
                  console.log("child", child);
                  return (
                    <div
                      key={child.id}
                      className={`${styles["multi-llm-tab"]} ${
                        selectedChildId === child.id ? styles["active"] : ""
                      }`}
                      onClick={() => setSelectedChildId(child.id)}
                    >
                      {session.multiMode === "agents"
                        ? child?.mask?.name || ""
                        : getLlmModelLabel(child?.llmModel)}
                    </div>
                  );
                })}
              </div>
            )}

            {multiViewMode === "grid" ? (
              <div className={styles["multi-llm-grid"]}>
                {session.multiLlmChildren.map((child) => (
                  <div key={child.id} className={styles["multi-llm-pane"]}>
                    <div className={styles["multi-llm-pane-header"]}>
                      {session.multiMode === "agents"
                        ? child?.mask?.name || ""
                        : getLlmModelLabel(child.llmModel)}
                    </div>
                    <div className={styles["multi-llm-messages"]}>
                      {child.messages.map((message) => (
                        <div
                          key={message.id}
                          className={
                            message.role === "user"
                              ? styles["chat-message-user"]
                              : styles["chat-message"]
                          }
                        >
                          <div className={styles["chat-message-container"]}>
                            <div className={styles["chat-message-item"]}>
                              <Markdown
                                content={getMessageTextContent(message)}
                                loading={
                                  message.streaming &&
                                  message.content.length === 0 &&
                                  message.role !== "user"
                                }
                                fontSize={fontSize}
                                parentRef={scrollRef}
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                    {!hasMalicious && (
                      <div className={styles["multi-llm-input"]}>
                        <textarea
                          rows={1}
                          placeholder={
                            session.multiMode === "agents"
                              ? `Send to ${child?.mask?.name || "this pane"}`
                              : `Send to ${getLlmModelLabel(child.llmModel)}`
                          }
                          value={childInputs[child.id] || ""}
                          onInput={(e) =>
                            setChildInput(child.id, e.currentTarget.value)
                          }
                          onKeyDown={(e) => {
                            if (shouldSubmit(e)) {
                              doChildSubmit(child.id);
                              e.preventDefault();
                            }
                          }}
                        />
                        <IconButton
                          icon={<SendWhiteIcon />}
                          text={Locale.Chat.Send}
                          onClick={() => doChildSubmit(child.id)}
                        />
                      </div>
                    )}
                  </div>
                ))}
                <div className={styles["multi-llm-spacer"]} />
              </div>
            ) : (
              (() => {
                const child =
                  session.multiLlmChildren.find(
                    (c) => c.id === selectedChildId,
                  ) || session.multiLlmChildren[0];
                if (!child) return null;
                return (
                  <div className={styles["multi-llm-single"]}>
                    <div className={styles["multi-llm-pane"]}>
                      <div className={styles["multi-llm-pane-header"]}>
                        {session.multiMode === "agents"
                          ? child?.mask?.name || ""
                          : getLlmModelLabel(child.llmModel)}
                      </div>
                      <div className={styles["multi-llm-messages"]}>
                        {child.messages.map((message) => (
                          <div
                            key={message.id}
                            className={
                              message.role === "user"
                                ? styles["chat-message-user"]
                                : styles["chat-message"]
                            }
                          >
                            <div className={styles["chat-message-container"]}>
                              <div className={styles["chat-message-item"]}>
                                <Markdown
                                  content={getMessageTextContent(message)}
                                  loading={
                                    message.streaming &&
                                    message.content.length === 0 &&
                                    message.role !== "user"
                                  }
                                  fontSize={fontSize}
                                  parentRef={scrollRef}
                                />
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                      {!hasMalicious && (
                        <div className={styles["multi-llm-input"]}>
                          <textarea
                            rows={1}
                            placeholder={
                              session.multiMode === "agents"
                                ? `Send to ${child?.mask?.name || "this pane"}`
                                : `Send to ${getLlmModelLabel(child.llmModel)}`
                            }
                            value={childInputs[child.id] || ""}
                            onInput={(e) =>
                              setChildInput(child.id, e.currentTarget.value)
                            }
                            onKeyDown={(e) => {
                              if (shouldSubmit(e)) {
                                doChildSubmit(child.id);
                                e.preventDefault();
                              }
                            }}
                          />
                          <IconButton
                            icon={<SendWhiteIcon />}
                            text={Locale.Chat.Send}
                            onClick={() => doChildSubmit(child.id)}
                          />
                        </div>
                      )}
                    </div>
                    <div className={styles["multi-llm-spacer"]} />
                  </div>
                );
              })()
            )}
          </div>
        ) : (
          <div
            className={styles["chat-messages-container"]}
            style={{ paddingBottom: Math.max(240, inputPanelHeight + 64) }}
          >
            {messages.map((message, i) => {
              if (message.role === "system") {
                return;
              }
              const isUser = message.role === "user";
              const isContext = i < context.length;
              const showActions =
                i > 0 &&
                !(message.preview || message.content.length === 0) &&
                !isContext;
              const showTyping = message.preview || message.streaming;
              // when the answer should wear the box that says it went wrong
              const showNoAnswer =
                (message.retrying || message.isError) && !isUser;
              // the files/images to show under this message (read them once)
              const msgImages = getMessageImages(message);
              const msgImageNames = getMessageImageNames(message);
              const msgFiles = getMessageFiles(message);

              const shouldShowClearContextDivider = i === clearContextIndex - 1;

              return (
                <Fragment key={message.id}>
                  <div
                    className={
                      isUser
                        ? styles["chat-message-user"]
                        : styles["chat-message"]
                    }
                  >
                    <div className={styles["chat-message-container"]}>
                      <div className={styles["chat-message-header"]}>
                        <div className={styles["chat-message-avatar"]}>
                          <div className={styles["chat-message-edit"]}>
                            <IconButton
                              icon={<EditIcon />}
                              disabled={message.streaming}
                              onClick={async () => {
                                const newMessage = await showPrompt(
                                  Locale.Chat.Actions.Edit,
                                  getMessageTextContent(message),
                                  10,
                                );
                                // Only the text is edited. The pictures and
                                // files on the message stay as they are.
                                const rest = Array.isArray(message.content)
                                  ? message.content.filter(
                                      (part) => part.type !== "text",
                                    )
                                  : [];
                                const newContent: string | MultimodalContent[] =
                                  rest.length > 0
                                    ? [
                                        { type: "text", text: newMessage },
                                        ...rest,
                                      ]
                                    : newMessage;
                                chatStore.updateCurrentSession((session) => {
                                  const m = session.mask.context
                                    .concat(session.messages)
                                    .find((m) => m.id === message.id);
                                  if (m) {
                                    m.content = newContent;
                                  }
                                });
                              }}
                            ></IconButton>
                          </div>
                        </div>

                        {false && (
                          <div className={styles["chat-message-actions"]}>
                            <div className={styles["chat-input-actions"]}>
                              {message.streaming ? (
                                <ChatAction
                                  text={Locale.Chat.Actions.Stop}
                                  icon={<StopIcon />}
                                  onClick={() => onUserStop(message.id ?? i)}
                                />
                              ) : (
                                <>
                                  <ChatAction
                                    text={Locale.Chat.Actions.Retry}
                                    icon={<ResetIcon />}
                                    onClick={() => onResend(message)}
                                  />

                                  <ChatAction
                                    text={Locale.Chat.Actions.Delete}
                                    icon={<DeleteIcon />}
                                    onClick={() => onDelete(message.id ?? i)}
                                  />

                                  <ChatAction
                                    text={Locale.Chat.Actions.Pin}
                                    icon={<PinIcon />}
                                    onClick={() => onPinMessage(message)}
                                  />
                                  <ChatAction
                                    text={Locale.Chat.Actions.Copy}
                                    icon={<CopyIcon />}
                                    onClick={() =>
                                      copyToClipboard(
                                        getMessageTextContent(message),
                                      )
                                    }
                                  />
                                </>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                      <div
                        className={
                          styles["chat-message-item"] +
                          (showNoAnswer
                            ? " " + styles["chat-message-item-warning"]
                            : "")
                        }
                      >
                        {showNoAnswer && (
                          <WarningIcon
                            className={styles["chat-message-warning-icon"]}
                          />
                        )}
                        {message.retrying && (
                          <div className={styles["chat-message-retrying"]}>
                            {Locale.Chat.NoResponse.Retrying}
                            <LoadingIcon />
                          </div>
                        )}
                        <Markdown
                          content={getMessageTextContent(message)}
                          loading={
                            (message.preview || message.streaming) &&
                            message.content.length === 0 &&
                            !isUser &&
                            !message.retrying
                          }
                          // onContextMenu={(e) => onRightClick(e, message)}
                          onDoubleClickCapture={() => {
                            if (!isMobileScreen) return;
                            setUserInput(getMessageTextContent(message));
                          }}
                          fontSize={fontSize}
                          parentRef={scrollRef}
                          defaultShow={i >= messages.length - 6}
                        />
                        {message.errorInfo && (
                          <ErrorInfo info={message.errorInfo} />
                        )}
                        {msgImages.length == 1 && (
                          <img
                            className={styles["chat-message-item-image"]}
                            src={msgImages[0]}
                            alt=""
                            title={msgImageNames[0] || undefined}
                            onClick={() =>
                              openImageViewer(msgImages[0], msgImageNames[0])
                            }
                          />
                        )}
                        {msgImages.length > 1 && (
                          <div
                            className={styles["chat-message-item-images"]}
                            style={
                              {
                                // at most 3 in a row. More pictures go on the
                                // next row so they do not all get smaller
                                "--image-count": Math.min(msgImages.length, 3),
                              } as React.CSSProperties
                            }
                          >
                            {msgImages.map((image, index) => {
                              const name = msgImageNames[index] || "";
                              return (
                                <img
                                  className={
                                    styles["chat-message-item-image-multi"]
                                  }
                                  key={index}
                                  src={image}
                                  alt=""
                                  title={name || undefined}
                                  onClick={() => openImageViewer(image, name)}
                                />
                              );
                            })}
                          </div>
                        )}
                        {msgFiles.length > 0 && (
                          <div className={styles["chat-message-item-files"]}>
                            {msgFiles.map((file, index) => (
                              <div
                                className={styles["chat-message-item-file"]}
                                key={index}
                                title={file.name}
                                onClick={() => setViewerAttachment(file)}
                              >
                                <span
                                  className={
                                    styles["chat-message-item-file-name"]
                                  }
                                >
                                  {file.name}
                                </span>
                                <span
                                  className={
                                    styles["chat-message-item-file-label"]
                                  }
                                >
                                  {fileTypeLabel(file)}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {message.isError && !isUser && (
                        <div className={styles["chat-message-tools"]}>
                          <IconButton
                            text={Locale.Chat.Actions.Retry}
                            icon={<RetryIcon />}
                            bordered
                            onClick={() => onResend(message)}
                          />
                          <IconButton
                            text={Locale.Home.NewChat}
                            icon={<PlusIcon />}
                            bordered
                            onClick={() => chatStore.newSession()}
                          />
                        </div>
                      )}

                      {env.ENABLE_TTSASR && !isUser && (
                        <div className={styles["chat-message-tools"]}>
                          <TTSButton
                            message={getMessageTextContent(message)}
                            messageKey={message.id}
                            tts={tts}
                          />
                          <IconButton
                            title={Locale.Chat.Actions.Copy}
                            icon={
                              <CopyTextIcon
                                style={{
                                  width: 16,
                                  height: 16,
                                  color: "var(--primary)",
                                }}
                              />
                            }
                            onClick={() =>
                              copyToClipboard(getMessageTextContent(message))
                            }
                          />
                        </div>
                      )}

                      {/* <div className={styles["chat-message-action-date"]}>
                      {isContext
                        ? Locale.Chat.IsContext
                        : message.date.toLocaleString()}
                    </div> */}
                    </div>
                  </div>
                  {shouldShowClearContextDivider && <ClearContextDivider />}
                </Fragment>
              );
            })}
          </div>
        )}
      </div>

      {!hasMalicious && (
        <div
          className={styles["chat-input-panel-container"]}
          ref={inputPanelRef}
        >
          <div
            className={`${styles["chat-input-panel"]} ${
              isDragging ? styles["chat-input-panel-dragging"] : ""
            }`}
            onDragOver={(e) => {
              e.preventDefault();
              if (canAttach) setIsDragging(true);
            }}
            onDragLeave={(e) => {
              e.preventDefault();
              setIsDragging(false);
            }}
            onDrop={onDropFiles}
          >
            <PromptHints
              prompts={promptHints}
              onPromptSelect={onPromptSelect}
            />

            {
              <ChatActions
                uploadImage={uploadImage}
                clearImages={() =>
                  updateAttachments({
                    ...attachmentsRef.current,
                    images: [],
                    imageNames: [],
                  })
                }
                showPromptModal={() => setShowPromptModal(true)}
                scrollToBottom={scrollToBottom}
                hitBottom={hitBottom}
                uploading={uploading}
                showPromptHints={() => {
                  // Click again to close
                  if (promptHints.length > 0) {
                    setPromptHints([]);
                    return;
                  }
                  inputRef.current?.focus();
                  setUserInput("/");
                  onSearch("");
                }}
                setShowFeedback={setShowFeedback}
              />
            }
            <div className={styles["chat-input-row"]}>
              {canAttach && (
                <div
                  className={`${styles["chat-input-attach"]} ${
                    hasAttachments ? styles["chat-input-icon-pinned"] : ""
                  }`}
                  onClick={uploading ? undefined : uploadImage}
                  role="button"
                  aria-label="Vedhæft fil"
                  title={Locale.Chat.InputActions.UploadImage}
                >
                  <div className={styles["chat-input-attach-icon"]}>
                    {uploading ? (
                      <LoadingButtonIcon style={{ width: 25, height: 25 }} />
                    ) : (
                      <PlusIcon style={{ width: 25, height: 25 }} />
                    )}
                  </div>
                  <div className={styles["chat-input-attach-spacer"]} />
                </div>
              )}
              {env.ENABLE_TTSASR && (
                <RecorderIcon
                  onTranscribed={onInput}
                  className={
                    hasAttachments ? styles["chat-input-icon-pinned"] : undefined
                  }
                />
              )}
              <label
                className={`${styles["chat-input-panel-inner"]} ${
                  hasAttachments ? styles["chat-input-panel-inner-attach"] : ""
                }`}
                htmlFor="chat-input"
              >
                {hasAttachments && (
                  <div className={styles["attach-list"]}>
                    {attachImages.map((image, index) => (
                      <div
                        className={styles["attach-item"]}
                        key={`img-${index}`}
                      >
                        <img
                          className={styles["attach-item-image"]}
                          src={image}
                          alt=""
                          title={attachImageNames[index] || undefined}
                          onClick={() =>
                            openImageViewer(image, attachImageNames[index])
                          }
                        />
                        <button
                          type="button"
                          className={styles["attach-remove"]}
                          title="Fjern"
                          onClick={() => {
                            const current = attachmentsRef.current;
                            updateAttachments({
                              ...current,
                              images: current.images.filter(
                                (_, i) => i !== index,
                              ),
                              imageNames: current.imageNames.filter(
                                (_, i) => i !== index,
                              ),
                            });
                          }}
                        >
                          <PlusIcon />
                        </button>
                      </div>
                    ))}
                    {attachFiles.map((file, index) => {
                      const warning =
                        !uploading &&
                        attachmentNotice?.source === attachments &&
                        attachmentNotice.messages[index];
                      return (
                        <div
                          className={styles["attach-item"]}
                          key={file.id || `file-${index}`}
                        >
                          <div
                            className={styles["attach-item-file"]}
                            title={file.name}
                            onClick={() => setViewerAttachment(file)}
                          >
                            {file.preview ? (
                              <>
                                <img
                                  className={styles["attach-item-file-preview"]}
                                  src={file.preview}
                                  alt=""
                                />
                                <span
                                  className={styles["attach-item-file-badge"]}
                                >
                                  {fileTypeLabel(file)}
                                </span>
                              </>
                            ) : (
                              <span
                                className={styles["attach-item-file-label"]}
                              >
                                {fileTypeLabel(file)}
                              </span>
                            )}
                          </div>
                          <button
                            type="button"
                            className={styles["attach-remove"]}
                            title="Fjern"
                            onClick={() => {
                              if (file.id) deleteFileBlob(file.id);
                              updateAttachments({
                                ...attachmentsRef.current,
                                files: attachmentsRef.current.files.filter(
                                  (attached) => attached !== file,
                                ),
                              });
                            }}
                          >
                            <PlusIcon />
                          </button>
                          {warning && (
                            <button
                              type="button"
                              className={styles["attach-warning"]}
                              title={warning}
                              aria-label={warning}
                              onClick={(event) => {
                                event.preventDefault();
                                showToast(warning, undefined, 9000);
                              }}
                            >
                              <svg
                                viewBox="0 0 24 24"
                                aria-hidden="true"
                                focusable="false"
                              >
                                <path d="M10.3 4.3a2 2 0 0 1 3.4 0l7.4 12.8a2 2 0 0 1-1.7 3H4.6a2 2 0 0 1-1.7-3Z" />
                                <path d="M12 9v4m0 3h.01" />
                              </svg>
                            </button>
                          )}
                        </div>
                      );
                    })}
                    {!uploading &&
                      attachmentNotice?.source === attachments &&
                      attachmentNotice.error && (
                        <div className={styles["attach-notice"]} role="status">
                          {attachmentNotice.error}
                        </div>
                      )}
                  </div>
                )}
                <textarea
                  id="chat-input"
                  ref={inputRef}
                  className={styles["chat-input"]}
                  placeholder={Locale.Chat.Input(submitKey)}
                  onInput={(e) => onInput(e.currentTarget.value)}
                  value={userInput}
                  onKeyDown={onInputKeyDown}
                  onFocus={() => {
                    if (
                      !(
                        session.multiLlmChildren &&
                        session.multiLlmChildren.length > 0
                      )
                    ) {
                      scrollToBottom();
                    }
                  }}
                  onClick={() => {
                    if (
                      !(
                        session.multiLlmChildren &&
                        session.multiLlmChildren.length > 0
                      )
                    ) {
                      scrollToBottom();
                    }
                  }}
                  onPaste={handlePaste}
                  rows={inputRows}
                  autoFocus={autoFocus}
                  style={{
                    fontSize: config.fontSize,
                  }}
                />
                <IconButton
                  icon={<SendArrowIcon />}
                  className={styles["chat-input-send"]}
                  type="primary"
                  onClick={() => {
                    doSubmit(userInput);
                  }}
                />
              </label>
            </div>
          </div>
        </div>
      )}
      {env.CHAT_DISCLAIMER && (
        <div className={styles["chat-disclaimer"]}>{env.CHAT_DISCLAIMER}</div>
      )}
      {showExport && (
        <ExportMessageModal onClose={() => setShowExport(false)} />
      )}

      {showFeedback && (
        <FeedbackModal
          chatRef={scrollRef}
          onClose={() => setShowFeedback(false)}
        />
      )}

      {isEditingMessage && (
        <EditMessageModal
          onClose={() => {
            setIsEditingMessage(false);
          }}
        />
      )}

      {viewerAttachment && (
        <div className="modal-mask">
          <Modal
            title={viewerAttachment.name || "Vedhæftning"}
            defaultMax={true}
            onClose={() => setViewerAttachment(null)}
          >
            <div className={styles["attachment-viewer"]}>
              {/* A browser cannot show a Word file. So the viewer shows the
                  text that was read from it for the model. Drawing the real
                  file with a library would let its styles leak into the app.
                  The text is saved with the chat and works even when the
                  saved file is gone. */}
              {viewerAttachment.mime === DOCX_MIME ? (
                <div className={styles["attachment-viewer-text"]}>
                  {viewerAttachment.text || "Dokumentet kan ikke vises."}
                </div>
              ) : !viewer.url ? (
                <p>Filen kan ikke længere vises.</p>
              ) : viewerAttachment.mime.startsWith("image/") ? (
                <img src={viewer.url} alt="" />
              ) : (
                <iframe
                  className={styles["attachment-viewer-frame"]}
                  src={viewer.url}
                  title={viewerAttachment.name}
                  // An attached web page must not run code on our page. A PDF
                  // is not sandboxed because Chrome cannot show one that way.
                  sandbox={viewer.isPdf ? undefined : ""}
                />
              )}
            </div>
          </Modal>
        </div>
      )}
    </div>
  );
}

export function Chat() {
  const chatStore = useChatStore();
  return <_Chat key={chatStore.currentSession().id}></_Chat>;
}
