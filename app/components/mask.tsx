import { IconButton } from "./button";
import { ErrorBoundary } from "./error";

import styles from "./mask.module.scss";

import DownloadIcon from "../icons/download.svg";
import UploadIcon from "../icons/upload.svg";
import EditIcon from "../icons/edit.svg";
import AddIcon from "../icons/add.svg";
import PlusIcon from "../icons/plus.svg";
import LoadingButtonIcon from "../icons/loading.svg";
import AttachIcon from "../icons/attach.svg";
import CloseIcon from "../icons/close.svg";
import ConfirmBoldIcon from "../icons/confirm-bold.svg";
import MoreIcon from "../icons/more.svg";
import DeleteIcon from "../icons/delete.svg";
import EyeIcon from "../icons/eye.svg";
import EyeOffIcon from "../icons/eye-off.svg";
import CopyIcon from "../icons/copy.svg";
import DragIcon from "../icons/drag.svg";
import ShareIcon from "../icons/share.svg";
import QrIcon from "../icons/qr.svg";

import {
  DEFAULT_MASK_AVATAR,
  isSystemPromptHidden,
  encodeHiddenPrompt,
  Mask,
  useMaskStore,
} from "../store/mask";
import {
  ChatMessage,
  createMessage,
  DEFAULT_TOPIC,
  ModelConfig,
  ModelType,
  useAppConfig,
  useChatStore,
} from "../store";
import { MultimodalContent, ROLES } from "../client/api";
import {
  Input,
  List,
  ListItem,
  Modal,
  Popover,
  Select,
  showConfirm,
  showToast,
} from "./ui-lib";
import { fileToAttachment, FILE_ACCEPT } from "../utils/attachment";
import { Avatar, AvatarPicker } from "./emoji";
import Locale, { AllLangs, ALL_LANG_OPTIONS, Lang } from "../locales";
import { useNavigate } from "react-router-dom";
import QRCode from "react-qr-code";

import chatStyle from "./chat.module.scss";
import { useEffect, useRef, useState } from "react";
import {
  copyToClipboard,
  downloadAs,
  getMessageImages,
  readFromFile,
} from "../utils";
import { MessageRole, Updater } from "../typing";
import { ModelConfigList } from "./model-config";
import { FileName, Path } from "../constant";
import { BUILTIN_MASK_STORE } from "../masks";
import { nanoid } from "nanoid";
import {
  DragDropContext,
  Droppable,
  Draggable,
  OnDragEndResponder,
} from "@hello-pangea/dnd";
import { getMessageTextContent } from "../utils";
import { InputRange } from "./input-range";
import { env } from "../utils/appsettings";

// drag and drop helper function
function reorder<T>(list: T[], startIndex: number, endIndex: number): T[] {
  const result = [...list];
  const [removed] = result.splice(startIndex, 1);
  result.splice(endIndex, 0, removed);
  return result;
}

// Build an app link with the assistant name and optional system prompt.
// URLSearchParams does the URL encoding.
function buildAssistantParamLink(
  mask: Mask,
  path: string,
  hideSystemPrompt: boolean,
): string {
  const systemPrompt = mask.context?.[0]
    ? getMessageTextContent(mask.context[0]).trim()
    : "";
  const url = new URL(path, location.origin);
  url.searchParams.set("name", mask.name);
  if (systemPrompt && hideSystemPrompt) {
    url.searchParams.set("p", encodeHiddenPrompt(systemPrompt));
  } else if (systemPrompt) {
    url.searchParams.set("prompt", systemPrompt);
  }
  if (hideSystemPrompt) url.searchParams.set("h", "1");
  return url.toString();
}

export function buildSkoletubeShareLink(
  mask: Mask,
  hideSystemPrompt: boolean,
): string {
  const systemPrompt = mask.context?.[0]
    ? getMessageTextContent(mask.context[0]).trim()
    : "";

  // SkoleTube needs embed_code, so we wrap the launch page in an iframe.
  const launchLink = buildAssistantParamLink(
    mask,
    Path.Skoletube,
    hideSystemPrompt,
  );
  const embedCode = `<iframe src="${launchLink}" width="100%" height="400" frameborder="0"></iframe>`;

  // Open SkoleTube's publish page with this assistant prefilled.
  const publishUrl = new URL("https://www.skoletube.dk/media/publish/");
  publishUrl.searchParams.set("method", "embed");
  publishUrl.searchParams.set("embed_code", embedCode);
  publishUrl.searchParams.set("iframe", "true");
  publishUrl.searchParams.set("title", mask.name);
  if (systemPrompt && !hideSystemPrompt)
    publishUrl.searchParams.set("description", systemPrompt);
  publishUrl.searchParams.set("keyword", "skolegpt assistent");

  return publishUrl.toString();
}

export function MaskAvatar(props: { avatar: string; model?: ModelType }) {
  return props.avatar !== DEFAULT_MASK_AVATAR ? (
    <Avatar avatar={props.avatar} />
  ) : (
    <Avatar model={props.model} />
  );
}

// Short label for an uploaded file, e.g. "PDF" or "TXT" (same as in the chat).
function fileTypeLabel(file: { mime: string; name: string }): string {
  if (file.mime === "application/pdf") return "PDF";
  const ext = (file.name.split(".").pop() || "").toUpperCase();
  return ext.slice(0, 4) || "FIL";
}

// The system prompt textarea with the eye button that hides the prompt in the
// UI. Used by both the simple view and the SkoleGPT guided editor.
function SystemPromptField(props: {
  mask: Mask;
  updateMask: Updater<Mask>;
  readonly?: boolean;
  placeholder?: string;
}) {
  const globalConfig = useAppConfig();

  // readonly (builtin) masks can't be saved to directly, so their hidden
  // state is tracked separately in the app config by mask id instead.
  const hiddenBuiltinMaskIds = globalConfig.hiddenSystemPromptMaskIds ?? [];
  const systemPromptHidden = isSystemPromptHidden(
    props.mask,
    hiddenBuiltinMaskIds,
  );

  const toggleSystemPromptHidden = () => {
    if (props.readonly) {
      globalConfig.update((c) => {
        const ids = new Set(c.hiddenSystemPromptMaskIds ?? []);
        if (ids.has(props.mask.id)) {
          ids.delete(props.mask.id);
        } else {
          ids.add(props.mask.id);
        }
        c.hiddenSystemPromptMaskIds = Array.from(ids);
      });
    } else {
      props.updateMask((mask) => {
        mask.hideSystemPrompt = !systemPromptHidden;
      });
    }
  };

  // same check as getRequestContextPrompts, so the label shows only when the
  // files are actually sent
  const hasFiles =
    !!env.MASK_GUIDED_EDITOR && (props.mask.files?.length ?? 0) > 0;

  return (
    <div className={chatStyle["context-prompt"]} style={{ marginBottom: 4 }}>
      <div className={chatStyle["context-prompt-row"]}>
        <div style={{ position: "relative", flex: 1, maxWidth: "100%" }}>
          <Input
            value={(props.mask.context?.[0]?.content as string) || ""}
            placeholder={props.placeholder}
            type="text"
            className={chatStyle["context-content"]}
            style={{
              width: "100%",
              boxSizing: "border-box",
              paddingRight: 32,
              // room for the upload label at the bottom of the field
              ...(hasFiles ? { paddingBottom: 40 } : {}),
              ...(systemPromptHidden ? { color: "#d0d0d0" } : {}),
            }}
            rows={5}
            onInput={(e) =>
              props.updateMask((mask) => {
                // keeps the other prompts (ContextPrompts in the advanced
                // settings)
                mask.context = [
                  {
                    ...(mask.context[0] || {}),
                    role: MessageRole.System,
                    content: e.currentTarget.value,
                  },
                  ...mask.context.slice(1),
                ];
              })
            }
          />
          <IconButton
            icon={systemPromptHidden ? <EyeOffIcon /> : <EyeIcon />}
            onClick={toggleSystemPromptHidden}
            size={2}
            title={
              systemPromptHidden ? "Vis systemprompt" : "Skjul systemprompt"
            }
            className={styles["system-prompt-eye"]}
          />
          {/* sent after the system prompt when there are uploaded files (see
              getRequestContextPrompts), so it is shown as a label in the field */}
          {hasFiles && (
            <div className={styles["system-prompt-upload"]}>
              {Locale.Mask.Config.UploadPrompt}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function MaskConfig(props: {
  mask: Mask;
  updateMask: Updater<Mask>;
  extraListItems?: JSX.Element;
  readonly?: boolean;
  shouldSyncFromGlobal?: boolean;
}) {
  const [showPicker, setShowPicker] = useState(false);

  const updateConfig = (updater: (config: ModelConfig) => void) => {
    if (props.readonly) return;

    const config = { ...props.mask.modelConfig };
    updater(config);
    props.updateMask((mask) => {
      mask.modelConfig = config;
      // if user changed current session mask, it will disable auto sync
      mask.syncGlobalConfig = false;
    });
  };

  const copyMaskLink = () => {
    const maskLink = `${location.protocol}//${location.host}/#${Path.NewChat}?mask=${props.mask.id}`;
    copyToClipboard(maskLink);
  };

  const globalConfig = useAppConfig();

  const [showSimpleSettings, setShowSimpleSettings] = useState(true);

  // files for the upload field: the same pdf/text files as the attach button
  // in the chat; their text is read out once here (fileToAttachment)
  const files = props.mask.files ?? [];
  const [uploading, setUploading] = useState(false);

  async function addFiles(picked: File[]) {
    if (props.readonly || picked.length === 0) return;
    setUploading(true);
    try {
      for (const file of picked) {
        const attachment = await fileToAttachment(file);
        props.updateMask((mask) => {
          mask.files = [...(mask.files ?? []), attachment];
        });
      }
    } catch (e: any) {
      showToast(e?.message || "Kunne ikke uploade filen.");
    } finally {
      setUploading(false);
    }
  }

  function pickFiles() {
    const fileInput = document.createElement("input");
    fileInput.type = "file";
    fileInput.accept = FILE_ACCEPT;
    fileInput.multiple = true;
    fileInput.onchange = (event: any) =>
      addFiles(Array.from(event.target.files || []));
    fileInput.click();
  }

  // SkoleGPT: icon, name and system prompt as fields with example
  // placeholders, and the advanced settings in a fold-out section instead of
  // a checkbox that switches the whole view
  if (env.MASK_GUIDED_EDITOR) {
    return (
      <div className={styles["guided-editor"]}>
        <div className={styles["guided-row"]}>
          <div className={styles["guided-field"]}>
            <div className={styles["guided-title"]}>
              {Locale.Mask.Config.Avatar}
            </div>
            <Popover
              content={
                <AvatarPicker
                  onEmojiClick={(emoji) => {
                    props.updateMask((mask) => (mask.avatar = emoji));
                    setShowPicker(false);
                  }}
                ></AvatarPicker>
              }
              open={showPicker}
              onClose={() => setShowPicker(false)}
            >
              <button
                type="button"
                className={styles["guided-avatar-field"]}
                onClick={() => setShowPicker(true)}
              >
                <MaskAvatar
                  avatar={props.mask.avatar}
                  model={props.mask.modelConfig.model}
                />
                <span className={styles["guided-avatar-hint"]}>
                  {Locale.Mask.Config.AvatarHint}
                </span>
                <PlusIcon className={styles["guided-avatar-plus"]} />
              </button>
            </Popover>
          </div>

          <label className={styles["guided-field"]}>
            <div className={styles["guided-title"]}>
              {Locale.Mask.Config.Name}
            </div>
            <input
              type="text"
              className={styles["guided-name-input"]}
              placeholder={Locale.Mask.Config.NamePlaceholder}
              // a new assistant is named "Nyoprettet Assistent"; show the field
              // empty so the example is visible, and fall back to that name when
              // the field is emptied so the assistant never ends up without one
              value={props.mask.name === DEFAULT_TOPIC ? "" : props.mask.name}
              onInput={(e) => {
                const name = e.currentTarget.value;
                props.updateMask((mask) => {
                  mask.name = name.trim() === "" ? DEFAULT_TOPIC : name;
                });
              }}
            ></input>
          </label>
        </div>

        <div className={styles["guided-field"]}>
          <div className={styles["guided-title"]}>
            {Locale.Mask.Config.SystemPrompt}
          </div>
          <SystemPromptField
            mask={props.mask}
            updateMask={props.updateMask}
            readonly={props.readonly}
            placeholder={Locale.Mask.Config.SystemPromptPlaceholder}
          />
        </div>

        <div className={styles["guided-field"]}>
          <div className={styles["guided-title"]}>
            {Locale.Mask.Config.Upload}
          </div>
          {/* like the attach button in the chat: click or drop files here */}
          <button
            type="button"
            className={styles["guided-upload-field"]}
            disabled={props.readonly || uploading}
            onClick={pickFiles}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              addFiles(Array.from(e.dataTransfer?.files || []));
            }}
          >
            {uploading ? (
              <LoadingButtonIcon className={styles["guided-upload-plus"]} />
            ) : (
              <AttachIcon className={styles["guided-upload-plus"]} />
            )}
            <span className={styles["guided-upload-hint"]}>
              {Locale.Mask.Config.UploadHint}
            </span>
            <span className={styles["guided-upload-note"]}>
              {Locale.Mask.Config.UploadNote}
            </span>
          </button>
          {files.length > 0 && (
            <div className={chatStyle["attach-list"]}>
              {files.map((file, index) => (
                <div
                  className={chatStyle["attach-item"]}
                  key={file.id ?? index}
                >
                  <div
                    className={chatStyle["attach-item-file"]}
                    style={{ cursor: "default" }}
                    title={file.name}
                  >
                    {file.preview ? (
                      <>
                        <img
                          className={chatStyle["attach-item-file-preview"]}
                          src={file.preview}
                          alt=""
                        />
                        <span className={chatStyle["attach-item-file-badge"]}>
                          {fileTypeLabel(file)}
                        </span>
                      </>
                    ) : (
                      <span className={chatStyle["attach-item-file-label"]}>
                        {fileTypeLabel(file)}
                      </span>
                    )}
                  </div>
                  {!props.readonly && (
                    <button
                      type="button"
                      className={chatStyle["attach-remove"]}
                      title="Fjern"
                      // the saved file is kept (no deleteFileBlob): chats
                      // started from this assistant may still use it
                      onClick={() =>
                        props.updateMask((mask) => {
                          mask.files = (mask.files ?? []).filter(
                            (_, i) => i !== index,
                          );
                        })
                      }
                    >
                      <PlusIcon />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <details className={styles["guided-advanced"]}>
          <summary>{Locale.Mask.Config.Advanced}</summary>
          {/* the prompts with a role (system, user, assistant), as in the
              advanced view of the other apps */}
          <ContextPrompts
            context={props.mask.context}
            updateContext={(updater) => {
              const context = props.mask.context.slice();
              updater(context);
              props.updateMask((mask) => (mask.context = context));
            }}
          />
          <List>
            <ListItem
              title={Locale.Mask.Config.HideContext.Title}
              subTitle={Locale.Mask.Config.HideContext.SubTitle}
            >
              <input
                aria-label={Locale.Mask.Config.HideContext.Title}
                type="checkbox"
                checked={props.mask.hideContext}
                onChange={(e) => {
                  props.updateMask((mask) => {
                    mask.hideContext = e.currentTarget.checked;
                  });
                }}
              ></input>
            </ListItem>
          </List>
          <List>
            <ModelConfigList
              modelConfig={{ ...props.mask.modelConfig }}
              updateConfig={updateConfig}
            />
            {props.extraListItems}
          </List>
        </details>
      </div>
    );
  }

  if (showSimpleSettings) {
    return (
      <>
        <div style={{ fontSize: 14, marginBottom: 8 }}>Systemprompt:</div>
        <SystemPromptField
          mask={props.mask}
          updateMask={props.updateMask}
          readonly={props.readonly}
        />
        <List>
          <ListItem title="Vis avancerede indstillinger">
            <input
              aria-label="Vis avancerede indstillinger"
              type="checkbox"
              checked={!showSimpleSettings}
              onChange={() => setShowSimpleSettings(false)}
            ></input>
          </ListItem>
          <ListItem title={Locale.Mask.Config.Avatar}>
            <Popover
              content={
                <AvatarPicker
                  onEmojiClick={(emoji) => {
                    props.updateMask((mask) => (mask.avatar = emoji));
                    setShowPicker(false);
                  }}
                ></AvatarPicker>
              }
              open={showPicker}
              onClose={() => setShowPicker(false)}
            >
              <div
                tabIndex={0}
                aria-label={Locale.Mask.Config.Avatar}
                onClick={() => setShowPicker(true)}
                style={{ cursor: "pointer" }}
              >
                <MaskAvatar
                  avatar={props.mask.avatar}
                  model={props.mask.modelConfig.model}
                />
              </div>
            </Popover>
          </ListItem>
          <ListItem title={Locale.Mask.Config.Name}>
            <input
              aria-label={Locale.Mask.Config.Name}
              type="text"
              value={props.mask.name}
              onInput={(e) =>
                props.updateMask((mask) => {
                  mask.name = e.currentTarget.value;
                })
              }
            ></input>
          </ListItem>
          <ListItem
            title={Locale.Mask.Config.HideContext.Title}
            subTitle={Locale.Mask.Config.HideContext.SubTitle}
          >
            <input
              aria-label={Locale.Mask.Config.HideContext.Title}
              type="checkbox"
              checked={props.mask.hideContext}
              onChange={(e) => {
                props.updateMask((mask) => {
                  mask.hideContext = e.currentTarget.checked;
                });
              }}
            ></input>
          </ListItem>
        </List>
        <List>
          <ListItem
            title={Locale.Settings.HistoryCount.Title}
            subTitle={Locale.Settings.HistoryCount.SubTitle}
          >
            <InputRange
              title={props.mask.modelConfig.historyMessageCount.toString()}
              value={props.mask.modelConfig.historyMessageCount}
              min="0"
              max="64"
              step="1"
              onChange={(e) =>
                updateConfig(
                  (config) =>
                    (config.historyMessageCount = e.target.valueAsNumber),
                )
              }
            ></InputRange>
          </ListItem>
        </List>
      </>
    );
  }

  return (
    <>
      <ContextPrompts
        context={props.mask.context}
        updateContext={(updater) => {
          const context = props.mask.context.slice();
          updater(context);
          props.updateMask((mask) => (mask.context = context));
        }}
      />

      <List>
        <ListItem title="Vis avancerede indstillinger">
          <input
            aria-label="Vis avancerede indstillinger"
            type="checkbox"
            checked={!showSimpleSettings}
            onChange={() => setShowSimpleSettings(true)}
          ></input>
        </ListItem>
        <ListItem title={Locale.Mask.Config.Avatar}>
          <Popover
            content={
              <AvatarPicker
                onEmojiClick={(emoji) => {
                  props.updateMask((mask) => (mask.avatar = emoji));
                  setShowPicker(false);
                }}
              ></AvatarPicker>
            }
            open={showPicker}
            onClose={() => setShowPicker(false)}
          >
            <div
              onClick={() => setShowPicker(true)}
              style={{ cursor: "pointer" }}
            >
              <MaskAvatar
                avatar={props.mask.avatar}
                model={props.mask.modelConfig.model}
              />
            </div>
          </Popover>
        </ListItem>
        <ListItem title={Locale.Mask.Config.Name}>
          <input
            type="text"
            value={props.mask.name}
            onInput={(e) =>
              props.updateMask((mask) => {
                mask.name = e.currentTarget.value;
              })
            }
          ></input>
        </ListItem>
        <ListItem
          title={Locale.Mask.Config.HideContext.Title}
          subTitle={Locale.Mask.Config.HideContext.SubTitle}
        >
          <input
            type="checkbox"
            checked={props.mask.hideContext}
            onChange={(e) => {
              props.updateMask((mask) => {
                mask.hideContext = e.currentTarget.checked;
              });
            }}
          ></input>
        </ListItem>

        {!props.shouldSyncFromGlobal ? (
          <ListItem
            title={Locale.Mask.Config.Share.Title}
            subTitle={Locale.Mask.Config.Share.SubTitle}
          >
            <IconButton
              icon={<CopyIcon />}
              text={Locale.Mask.Config.Share.Action}
              onClick={copyMaskLink}
            />
          </ListItem>
        ) : null}

        {props.shouldSyncFromGlobal ? (
          <ListItem
            title={Locale.Mask.Config.Sync.Title}
            subTitle={Locale.Mask.Config.Sync.SubTitle}
          >
            <input
              type="checkbox"
              checked={props.mask.syncGlobalConfig}
              onChange={async (e) => {
                const checked = e.currentTarget.checked;
                if (
                  checked &&
                  (await showConfirm(Locale.Mask.Config.Sync.Confirm))
                ) {
                  props.updateMask((mask) => {
                    mask.syncGlobalConfig = checked;
                    mask.modelConfig = { ...globalConfig.modelConfig };
                  });
                } else if (!checked) {
                  props.updateMask((mask) => {
                    mask.syncGlobalConfig = checked;
                  });
                }
              }}
            ></input>
          </ListItem>
        ) : null}
      </List>

      <List>
        <ModelConfigList
          modelConfig={{ ...props.mask.modelConfig }}
          updateConfig={updateConfig}
        />
        {props.extraListItems}
      </List>
    </>
  );
}

function ContextPromptItem(props: {
  index: number;
  prompt: ChatMessage;
  update: (prompt: ChatMessage) => void;
  remove: () => void;
}) {
  const [focusingInput, setFocusingInput] = useState(false);

  return (
    <div className={chatStyle["context-prompt-row"]}>
      {!focusingInput && (
        <>
          <div className={chatStyle["context-drag"]}>
            <DragIcon />
          </div>
          <Select
            value={props.prompt.role}
            className={chatStyle["context-role"]}
            onChange={(e) =>
              props.update({
                ...props.prompt,
                role: e.target.value as any,
              })
            }
          >
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </Select>
        </>
      )}
      <Input
        value={getMessageTextContent(props.prompt)}
        type="text"
        className={chatStyle["context-content"]}
        rows={focusingInput ? 5 : 1}
        onFocus={() => setFocusingInput(true)}
        onBlur={() => {
          setFocusingInput(false);
          // If the selection is not removed when the user loses focus, some
          // extensions like "Translate" will always display a floating bar
          window?.getSelection()?.removeAllRanges();
        }}
        onInput={(e) =>
          props.update({
            ...props.prompt,
            content: e.currentTarget.value as any,
          })
        }
      />
      {!focusingInput && (
        <IconButton
          icon={<DeleteIcon />}
          className={chatStyle["context-delete-button"]}
          onClick={() => props.remove()}
          bordered
        />
      )}
    </div>
  );
}

export function ContextPrompts(props: {
  context: ChatMessage[];
  updateContext: (updater: (context: ChatMessage[]) => void) => void;
}) {
  const context = props.context;

  const addContextPrompt = (prompt: ChatMessage, i: number) => {
    props.updateContext((context) => context.splice(i, 0, prompt));
  };

  const removeContextPrompt = (i: number) => {
    props.updateContext((context) => context.splice(i, 1));
  };

  const updateContextPrompt = (i: number, prompt: ChatMessage) => {
    props.updateContext((context) => {
      const images = getMessageImages(context[i]);
      context[i] = prompt;
      if (images.length > 0) {
        const text = getMessageTextContent(context[i]);
        const newContext: MultimodalContent[] = [{ type: "text", text }];
        for (const img of images) {
          newContext.push({ type: "image_url", image_url: { url: img } });
        }
        context[i].content = newContext;
      }
    });
  };

  const onDragEnd: OnDragEndResponder = (result) => {
    if (!result.destination) {
      return;
    }
    const newContext = reorder(
      context,
      result.source.index,
      result.destination.index,
    );
    props.updateContext((context) => {
      context.splice(0, context.length, ...newContext);
    });
  };

  return (
    <>
      <div className={chatStyle["context-prompt"]} style={{ marginBottom: 20 }}>
        <DragDropContext onDragEnd={onDragEnd}>
          <Droppable droppableId="context-prompt-list">
            {(provided) => (
              <div ref={provided.innerRef} {...provided.droppableProps}>
                {context.map((c, i) => (
                  <Draggable
                    draggableId={c.id || i.toString()}
                    index={i}
                    key={c.id}
                  >
                    {(provided) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.draggableProps}
                        {...provided.dragHandleProps}
                      >
                        <ContextPromptItem
                          index={i}
                          prompt={c}
                          update={(prompt) => updateContextPrompt(i, prompt)}
                          remove={() => removeContextPrompt(i)}
                        />
                        <div
                          className={chatStyle["context-prompt-insert"]}
                          onClick={() => {
                            addContextPrompt(
                              createMessage({
                                role: MessageRole.User,
                                content: "",
                                date: new Date().toLocaleString(),
                              }),
                              i + 1,
                            );
                          }}
                        >
                          <AddIcon />
                        </div>
                      </div>
                    )}
                  </Draggable>
                ))}
                {provided.placeholder}
              </div>
            )}
          </Droppable>
        </DragDropContext>

        {props.context.length === 0 && (
          <div className={chatStyle["context-prompt-row"]}>
            <IconButton
              icon={<AddIcon />}
              text={Locale.Context.Add}
              bordered
              className={chatStyle["context-prompt-button"]}
              onClick={() =>
                addContextPrompt(
                  createMessage({
                    role: MessageRole.User,
                    content: "",
                    date: "",
                  }),
                  props.context.length,
                )
              }
            />
          </div>
        )}
      </div>
    </>
  );
}

// The three share options shown in the "Del" popover: SkoleTube, a copyable
// link, and a QR code of that same link. Uses the existing link builders.
function ShareMenu(props: { mask: Mask }) {
  const [showQr, setShowQr] = useState(false);
  const globalConfig = useAppConfig();
  const systemPromptHidden = isSystemPromptHidden(
    props.mask,
    globalConfig.hiddenSystemPromptMaskIds ?? [],
  );
  const shareLink = buildAssistantParamLink(
    props.mask,
    Path.NewChat,
    systemPromptHidden,
  );

  return (
    <div className={styles["share-menu"]}>
      {/* SKOLETUBE OFF. The share on SkoleTube option is turned off until
          release day. To turn it back on remove the comment marks around the
          block below. */}
      <div
        className={`${styles["share-menu-item"]} clickable`}
        onClick={() =>
          window.open(
            buildSkoletubeShareLink(props.mask, systemPromptHidden),
            "_blank",
            "noopener,noreferrer",
          )
        }
      >
        <ShareIcon />
        <span>{Locale.Mask.EditModal.ShareSkoletube}</span>
      </div>
      <div
        className={`${styles["share-menu-item"]} clickable`}
        onClick={() => copyToClipboard(shareLink)}
      >
        <CopyIcon />
        <span>{Locale.Mask.EditModal.ShareLink}</span>
      </div>
      <div
        className={`${styles["share-menu-item"]} clickable`}
        onClick={() => setShowQr((v) => !v)}
      >
        <QrIcon />
        <span>Del via QR</span>
      </div>
      {showQr && (
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            padding: 16,
          }}
        >
          <QRCode value={shareLink} size={180} />
        </div>
      )}
    </div>
  );
}

// Open state for a footer button with a small menu anchored to it, closing
// when you click anywhere outside (same pattern as Modal's click-outside
// handling).
function useFooterMenu() {
  const [open, setOpen] = useState(false);
  const anchorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClickOutside = (e: MouseEvent) => {
      if (anchorRef.current && !anchorRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [open]);

  return { open, setOpen, anchorRef };
}

// The "..." button next to "Del" with the less used actions: download the
// assistant as a file and make a copy of it. The menu closes after a choice.
function MoreButton(props: { onDownload: () => void; onClone: () => void }) {
  const { open, setOpen, anchorRef } = useFooterMenu();

  return (
    <div
      ref={anchorRef}
      className={`${styles["share-button-anchor"]} ${styles["more-button-anchor"]}`}
    >
      <IconButton
        icon={<MoreIcon />}
        bordered
        className={`${styles["share-button"]} ${styles["more-button"]}`}
        title="Flere handlinger"
        onClick={() => setOpen((v) => !v)}
      />
      {open && (
        <div
          className={`${styles["share-menu-popup"]} ${styles["more-menu-popup"]}`}
        >
          <div className={styles["share-menu"]}>
            <div
              className={`${styles["share-menu-item"]} ${styles["download-menu-item"]} clickable`}
              onClick={() => {
                setOpen(false);
                props.onDownload();
              }}
            >
              <DownloadIcon />
              <span>{Locale.Mask.EditModal.Download}</span>
            </div>
            <div
              className={`${styles["share-menu-item"]} clickable`}
              onClick={() => {
                setOpen(false);
                props.onClone();
              }}
            >
              <CopyIcon />
              <span>{Locale.Mask.EditModal.Clone}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Wraps the "Del" button and anchors the ShareMenu directly below it.
function ShareButton(props: { mask: Mask }) {
  const { open, setOpen, anchorRef } = useFooterMenu();

  return (
    <div ref={anchorRef} className={styles["share-button-anchor"]}>
      <IconButton
        icon={<ShareIcon />}
        bordered
        className={styles["share-button"]}
        text="Del"
        onClick={() => setOpen((v) => !v)}
      />
      {open && (
        <div className={styles["share-menu-popup"]}>
          <ShareMenu mask={props.mask} />
        </div>
      )}
    </div>
  );
}

export function MaskPage() {
  const navigate = useNavigate();

  const maskStore = useMaskStore();
  const chatStore = useChatStore();

  const [filterLang, setFilterLang] = useState<Lang | undefined>(
    () => localStorage.getItem("Mask-language") as Lang | undefined,
  );
  useEffect(() => {
    if (filterLang) {
      localStorage.setItem("Mask-language", filterLang);
    } else {
      localStorage.removeItem("Mask-language");
    }
  }, [filterLang]);

  const allMasks = maskStore
    .getAll()
    .filter((m) => !filterLang || m.lang === filterLang);

  const [searchMasks, setSearchMasks] = useState<Mask[]>([]);
  const [searchText, setSearchText] = useState("");
  const masks = searchText.length > 0 ? searchMasks : allMasks;

  // refactored already, now it accurate
  const onSearch = (text: string) => {
    setSearchText(text);
    if (text.length > 0) {
      const result = allMasks.filter((m) =>
        m.name.toLowerCase().includes(text.toLowerCase()),
      );
      setSearchMasks(result);
    } else {
      setSearchMasks(allMasks);
    }
  };

  const [editingMaskId, setEditingMaskId] = useState<string | undefined>();
  const editingMask =
    maskStore.get(editingMaskId) ?? BUILTIN_MASK_STORE.get(editingMaskId);
  const closeMaskModal = () => setEditingMaskId(undefined);
  const downloadMask = (mask: Mask) =>
    downloadAs(JSON.stringify(mask), `${mask.name}.json`);
  const cloneMask = (mask: Mask) => {
    navigate(Path.Masks);
    maskStore.create(mask);
    setEditingMaskId(undefined);
  };

  const downloadAll = () => {
    downloadAs(JSON.stringify(masks.filter((v) => !v.builtin)), FileName.Masks);
  };

  const importFromFile = () => {
    readFromFile().then((content) => {
      try {
        const importMasks = JSON.parse(content);
        if (Array.isArray(importMasks)) {
          for (const mask of importMasks) {
            if (mask.name) {
              maskStore.create(mask);
            }
          }
          return;
        }
        //if the content is a single mask.
        if (importMasks.name) {
          maskStore.create(importMasks);
        }
      } catch {}
    });
  };

  return (
    <ErrorBoundary>
      <div className={styles["mask-page"]}>
        <div className="window-header">
          <div className="window-header-title">
            <div className="window-header-main-title">
              {Locale.Mask.Page.Title}
            </div>
            <div className="window-header-submai-title">
              {Locale.Mask.Page.SubTitle(allMasks.length)}
            </div>
          </div>

          <div className="window-actions">
            <div className="window-action-button">
              <IconButton
                icon={<DownloadIcon />}
                bordered
                onClick={downloadAll}
                text={Locale.UI.Export}
              />
            </div>
            <div className="window-action-button">
              <IconButton
                icon={<UploadIcon />}
                text={Locale.UI.Import}
                bordered
                onClick={() => importFromFile()}
              />
            </div>
            {/*
            <div className="window-action-button">
              <IconButton
                icon={<CloseIcon />}
                bordered
                onClick={() => navigate(-1)}
              />
            </div>
            */}
          </div>
        </div>

        <div className={styles["mask-page-body"]}>
          <div className={styles["mask-filter"]}>
            <input
              type="text"
              className={styles["search-bar"]}
              placeholder={Locale.Mask.Page.Search}
              autoFocus
              onInput={(e) => onSearch(e.currentTarget.value)}
            />
            {/*
            <Select
              className={styles["mask-filter-lang"]}
              value={filterLang ?? Locale.Settings.Lang.All}
              onChange={(e) => {
                const value = e.currentTarget.value;
                if (value === Locale.Settings.Lang.All) {
                  setFilterLang(undefined);
                } else {
                  setFilterLang(value as Lang);
                }
              }}
            >
              <option key="all" value={Locale.Settings.Lang.All}>
                {Locale.Settings.Lang.All}
              </option>
              {AllLangs.map((lang) => (
                <option value={lang} key={lang}>
                  {ALL_LANG_OPTIONS[lang]}
                </option>
              ))}
            </Select>
            */}

            <IconButton
              className={styles["mask-create"]}
              icon={<AddIcon />}
              text={Locale.Mask.Page.Create}
              bordered
              onClick={() => {
                const createdMask = maskStore.create();
                setEditingMaskId(createdMask.id);
              }}
            />
          </div>

          <div>
            {masks.map((m) => (
              <div className={styles["mask-item"]} key={m.id}>
                <div
                  className={styles["mask-header"]}
                  style={{ cursor: "pointer" }}
                  onClick={() => {
                    chatStore.newSession(m);
                    navigate(Path.Chat);
                  }}
                >
                  <div className={styles["mask-icon"]}>
                    <MaskAvatar avatar={m.avatar} model={m.modelConfig.model} />
                  </div>
                  <div className={styles["mask-title"]}>
                    <div className={styles["mask-name"]}>{m.name}</div>
                    <div className={styles["mask-info"] + " one-line"}>
                      {
                        /*
                      {`${Locale.Mask.Item.Info(m.context.length)} / ${
                        ALL_LANG_OPTIONS[m.lang]
                      } /  ${m.modelConfig.model}`}
                       */ m.modelConfig.model
                      }
                    </div>
                  </div>
                </div>
                <div className={styles["mask-actions"]}>
                  <IconButton
                    icon={<AddIcon />}
                    text={Locale.Mask.Item.Chat}
                    onClick={() => {
                      chatStore.newSession(m);
                      navigate(Path.Chat);
                    }}
                  />
                  {m.builtin ? (
                    <IconButton
                      icon={<EyeIcon />}
                      text={Locale.Mask.Item.View}
                      onClick={() => setEditingMaskId(m.id)}
                    />
                  ) : (
                    <IconButton
                      icon={<EditIcon />}
                      text={Locale.Mask.Item.Edit}
                      onClick={() => setEditingMaskId(m.id)}
                    />
                  )}
                  {!m.builtin && (
                    <IconButton
                      icon={<DeleteIcon />}
                      text={Locale.Mask.Item.Delete}
                      onClick={async () => {
                        if (await showConfirm(Locale.Mask.Item.DeleteConfirm)) {
                          maskStore.delete(m.id);
                        }
                      }}
                    />
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {editingMask && (
        <div
          className={
            env.MASK_GUIDED_EDITOR
              ? `modal-mask ${styles["guided-modal"]}`
              : "modal-mask"
          }
        >
          <Modal
            title={Locale.Mask.EditModal.Title(editingMask?.builtin)}
            onClose={closeMaskModal}
            // the "..." menu goes in the footer slot so it sits at the far
            // left, apart from the buttons on the right
            footer={
              env.MASK_MORE_MENU && (
                <MoreButton
                  onDownload={() => downloadMask(editingMask)}
                  onClone={() => cloneMask(editingMask)}
                />
              )
            }
            actions={[
              ...(env.MASK_MORE_MENU
                ? []
                : [
                    <IconButton
                      icon={<DownloadIcon />}
                      text={Locale.Mask.EditModal.Download}
                      key="export"
                      bordered
                      onClick={() => downloadMask(editingMask)}
                    />,
                    <IconButton
                      key="copy"
                      icon={<CopyIcon />}
                      bordered
                      text={Locale.Mask.EditModal.Clone}
                      onClick={() => cloneMask(editingMask)}
                    />,
                  ]),
              <ShareButton key="share" mask={editingMask} />,
              <IconButton
                key="close"
                icon={env.MASK_GUIDED_EDITOR ? <ConfirmBoldIcon /> : <CloseIcon />}
                bordered
                className={styles["save-button"]}
                text={Locale.Mask.EditModal.Save}
                onClick={closeMaskModal}
              />,
            ]}
          >
            <MaskConfig
              mask={editingMask}
              updateMask={(updater) =>
                maskStore.updateMask(editingMaskId!, updater)
              }
              readonly={editingMask.builtin}
            />
          </Modal>
        </div>
      )}
    </ErrorBoundary>
  );
}
