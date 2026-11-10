import { useEffect, useRef, useState } from "react";
import QRCode from "react-qr-code";
import { IconButton } from "./button";
import { Input, Modal } from "./ui-lib";
import maskStyles from "./mask.module.scss";
import styles from "./share-assistant.module.scss";
import CopyIcon from "../icons/copy.svg";
import EditIcon from "../icons/edit.svg";
import QrIcon from "../icons/qr.svg";
import RefreshIcon from "../icons/refresh.svg";
import LoadingButtonIcon from "../icons/loading.svg";
import Locale from "../locales";
import { encodeHiddenPrompt, isSystemPromptHidden, Mask } from "../store/mask";
import { createMessage, useAppConfig } from "../store";
import { ClientApi, FileAttachment } from "../client/api";
import { MessageRole } from "../typing";
import { ModelProvider, Path } from "../constant";
import { copyToClipboard, getMessageTextContent } from "../utils";
import { encodeFileSummaries, FileSummary } from "../utils/share-summary";

export type ShareView = "link" | "qr";

type SummaryField = FileSummary & { status: "loading" | "done" | "error" };

// Asks the model for a short summary of one uploaded file. The file goes in
// as a file part, so the client adds its text the same way as in the chat.
// An empty answer means the request failed (see the client's onFinish).
function summarizeFile(
  file: FileAttachment,
  model: string,
  onController: (controller: AbortController) => void,
): Promise<string> {
  const api = new ClientApi(
    model.startsWith("dbc") ? ModelProvider.DBC : ModelProvider.GPT,
  );
  return new Promise((resolve, reject) => {
    api.llm.chat({
      messages: [
        createMessage({
          role: MessageRole.System,
          content: Locale.Mask.Share.SummaryPrompt,
        }),
        createMessage({
          role: MessageRole.User,
          content: [{ type: "file", file }],
        }),
      ],
      config: { model, stream: false },
      onFinish: (message) =>
        message.trim()
          ? resolve(message.trim())
          : reject(new Error("Empty summary")),
      onError: reject,
      onController,
    });
  });
}

// Summaries of the assistant's files. The model makes them one file at a
// time when the popup opens; the teacher can edit them or make a new one.
// Closing the popup stops the requests.
function useFileSummaries(mask: Mask) {
  const files = mask.files ?? [];
  const [summaries, setSummaries] = useState<SummaryField[]>(() =>
    files.map((file) => ({
      name: file.name,
      summary: "",
      // without the file's text there is nothing to summarize
      status: file.text ? "loading" : "error",
    })),
  );
  const runRef = useRef({
    cancelled: false,
    controllers: [] as AbortController[],
  });

  const update = (index: number, change: Partial<SummaryField>) =>
    setSummaries((list) =>
      list.map((s, i) => (i === index ? { ...s, ...change } : s)),
    );

  const summarize = async (index: number, run = runRef.current) => {
    update(index, { summary: "", status: "loading" });
    try {
      const summary = await summarizeFile(
        files[index],
        mask.modelConfig.model,
        (controller) => run.controllers.push(controller),
      );
      if (!run.cancelled) update(index, { summary, status: "done" });
    } catch {
      if (!run.cancelled) update(index, { status: "error" });
    }
  };

  // Each run has its own cancelled flag, so a stopped request can't change
  // the fields of a newer run (React runs effects twice in development).
  useEffect(() => {
    const run = { cancelled: false, controllers: [] as AbortController[] };
    runRef.current = run;
    (async () => {
      for (let i = 0; i < files.length && !run.cancelled; i++) {
        if (files[i].text) await summarize(i, run);
      }
    })();
    return () => {
      run.cancelled = true;
      run.controllers.forEach((controller) => controller.abort());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    summaries,
    canSummarize: (index: number) => !!files[index]?.text,
    updateSummary: (index: number, summary: string) =>
      update(index, { summary }),
    summarize: (index: number) => summarize(index),
  };
}

// react-qr-code can't make a code from a much longer link (the QR limit is
// 2953 characters)
const MAX_QR_LINK_LENGTH = 2900;

// Build an app link with the assistant name and optional system prompt.
// URLSearchParams does the URL encoding.
export function buildAssistantParamLink(
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

// The link for the edited name, prompt and summaries. Packing the summaries
// is async, so a newer change cancels the older one.
function useShareLink(
  mask: Mask,
  name: string,
  prompt: string,
  summaries: FileSummary[],
) {
  const globalConfig = useAppConfig();
  const hideSystemPrompt = isSystemPromptHidden(
    mask,
    globalConfig.hiddenSystemPromptMaskIds ?? [],
  );
  const [link, setLink] = useState("");

  useEffect(() => {
    const baseLink = buildAssistantParamLink(
      {
        ...mask,
        name: name.trim() || mask.name,
        context: [createMessage({ role: MessageRole.System, content: prompt })],
      },
      Path.NewChat,
      hideSystemPrompt,
    );
    const filled = summaries
      .map((s) => ({ name: s.name, summary: s.summary.trim() }))
      .filter((s) => s.summary !== "");
    if (filled.length === 0) {
      setLink(baseLink);
      return;
    }

    let cancelled = false;
    encodeFileSummaries(filled).then((encoded) => {
      if (cancelled) return;
      const url = new URL(baseLink);
      url.searchParams.set("s", encoded);
      setLink(url.toString());
    });
    return () => {
      cancelled = true;
    };
  }, [mask, name, prompt, summaries, hideSystemPrompt]);

  return link;
}

// "Del assistent" (SkoleGPT): the teacher can change the name, the system
// prompt and the summaries of the files for the shared link only, then copy
// the link or show it as a QR code. The saved assistant isn't changed.
export function ShareAssistantModal(props: {
  mask: Mask;
  view: ShareView;
  onClose: () => void;
}) {
  const { mask, onClose } = props;
  const [view, setView] = useState<ShareView>(props.view);
  const [name, setName] = useState(mask.name);
  const [prompt, setPrompt] = useState(() =>
    mask.context?.[0] ? getMessageTextContent(mask.context[0]) : "",
  );
  const fileSummaries = useFileSummaries(mask);
  const { summaries } = fileSummaries;
  const link = useShareLink(mask, name, prompt, summaries);
  // the link is only ready once every summary is made
  const summarizing = summaries.some((s) => s.status === "loading");

  // The edit window behind also closes on Escape. Catch it first so Escape
  // only closes this popup.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.stopPropagation();
      onClose();
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [onClose]);

  return (
    // rendered inside the edit window, so clicks here don't close it
    <div className={`modal-mask ${maskStyles["guided-modal"]}`}>
      <Modal
        title={Locale.Mask.Share.Title}
        onClose={onClose}
        actions={[
          view === "link" ? (
            <IconButton
              key="qr"
              icon={<QrIcon />}
              bordered
              className={maskStyles["share-button"]}
              text={Locale.Mask.Share.ShowQr}
              onClick={() => setView("qr")}
            />
          ) : (
            <IconButton
              key="edit"
              icon={<EditIcon />}
              bordered
              className={maskStyles["share-button"]}
              text={Locale.Mask.Share.EditContent}
              onClick={() => setView("link")}
            />
          ),
          <IconButton
            key="copy"
            icon={<CopyIcon />}
            bordered
            className={`${maskStyles["save-button"]} ${styles["copy-button"]}`}
            text={Locale.Mask.Share.CopyLink}
            disabled={!link || summarizing}
            onClick={() => copyToClipboard(link)}
          />,
        ]}
      >
        {view === "link" ? (
          <ShareLinkView
            name={name}
            prompt={prompt}
            link={link}
            onNameChange={setName}
            onPromptChange={setPrompt}
            {...fileSummaries}
          />
        ) : (
          <ShareQrView
            name={name.trim() || mask.name}
            link={summarizing ? "" : link}
            summarizing={summarizing}
          />
        )}
      </Modal>
    </div>
  );
}

// Fields for what goes in the link, and the link itself
function ShareLinkView(props: {
  name: string;
  prompt: string;
  link: string;
  onNameChange: (name: string) => void;
  onPromptChange: (prompt: string) => void;
  summaries: SummaryField[];
  canSummarize: (index: number) => boolean;
  updateSummary: (index: number, summary: string) => void;
  summarize: (index: number) => void;
}) {
  const placeholder = (summary: SummaryField, index: number) => {
    if (summary.status === "loading") return Locale.Mask.Share.Summarizing;
    if (summary.status === "error") {
      return props.canSummarize(index)
        ? Locale.Mask.Share.SummaryFailed
        : Locale.Mask.Share.NoFileText;
    }
    return "";
  };

  return (
    <div className={maskStyles["guided-editor"]}>
      <p className={styles["note"]}>{Locale.Mask.Share.Note}</p>

      <label className={maskStyles["guided-field"]}>
        <div className={maskStyles["guided-title"]}>
          {Locale.Mask.Share.Name}
        </div>
        <input
          type="text"
          className={maskStyles["guided-name-input"]}
          value={props.name}
          onChange={(e) => props.onNameChange(e.currentTarget.value)}
        />
      </label>

      <label className={maskStyles["guided-field"]}>
        <div className={maskStyles["guided-title"]}>
          {Locale.Mask.Share.SystemPrompt}
        </div>
        <Input
          value={props.prompt}
          rows={4}
          onChange={(e) => props.onPromptChange(e.currentTarget.value)}
        />
      </label>

      {props.summaries.length > 0 && (
        <div className={maskStyles["guided-field"]}>
          <div className={maskStyles["guided-title"]}>
            {Locale.Mask.Share.Summaries}
          </div>
          <p className={styles["note"]}>{Locale.Mask.Share.SummariesNote}</p>
          {props.summaries.map((summary, i) => (
            <div key={i} className={styles["summary"]}>
              <div className={styles["summary-header"]}>
                <span className={styles["summary-name"]}>{summary.name}</span>
                {props.canSummarize(i) && (
                  <IconButton
                    icon={
                      summary.status === "loading" ? (
                        <LoadingButtonIcon />
                      ) : (
                        <RefreshIcon />
                      )
                    }
                    text={Locale.Mask.Share.NewSummary}
                    className={styles["new-summary"]}
                    disabled={summary.status === "loading"}
                    onClick={() => props.summarize(i)}
                  />
                )}
              </div>
              <Input
                aria-label={summary.name}
                value={summary.summary}
                rows={4}
                placeholder={placeholder(summary, i)}
                disabled={summary.status === "loading"}
                onChange={(e) => props.updateSummary(i, e.currentTarget.value)}
              />
            </div>
          ))}
        </div>
      )}

      <div className={maskStyles["guided-field"]}>
        <div className={maskStyles["guided-title"]}>
          {Locale.Mask.Share.Link}
        </div>
        <div className={styles["link"]}>{props.link}</div>
      </div>
    </div>
  );
}

// The link as a QR code for the students to scan
function ShareQrView(props: {
  name: string;
  link: string;
  summarizing: boolean;
}) {
  return (
    <div className={styles["qr"]}>
      {props.summarizing ? (
        <p className={styles["note"]}>{Locale.Mask.Share.Summarizing}</p>
      ) : props.link.length > MAX_QR_LINK_LENGTH ? (
        <p className={styles["note"]}>{Locale.Mask.Share.QrTooLong}</p>
      ) : (
        props.link && (
          <div className={styles["qr-code"]}>
            <QRCode value={props.link} size={240} />
          </div>
        )
      )}
      <div className={styles["qr-name"]}>{props.name}</div>
      <p className={styles["note"]}>{Locale.Mask.Share.QrNote}</p>
      {props.link && (
        <div className={`${styles["link"]} ${styles["link-short"]}`}>
          {props.link}
        </div>
      )}
    </div>
  );
}
