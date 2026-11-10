import { useEffect, useState } from "react";
import QRCode from "react-qr-code";
import { IconButton } from "./button";
import { Input, Modal } from "./ui-lib";
import maskStyles from "./mask.module.scss";
import styles from "./share-assistant.module.scss";
import CopyIcon from "../icons/copy.svg";
import EditIcon from "../icons/edit.svg";
import QrIcon from "../icons/qr.svg";
import Locale from "../locales";
import { encodeHiddenPrompt, isSystemPromptHidden, Mask } from "../store/mask";
import { createMessage, useAppConfig } from "../store";
import { MessageRole } from "../typing";
import { Path } from "../constant";
import { copyToClipboard, getMessageTextContent } from "../utils";
import { encodeFileSummaries, FileSummary } from "../utils/share-summary";

export type ShareView = "link" | "qr";

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
  const [summaries, setSummaries] = useState<FileSummary[]>(() =>
    (mask.files ?? []).map((file) => ({ name: file.name, summary: "" })),
  );
  const link = useShareLink(mask, name, prompt, summaries);

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
            disabled={!link}
            onClick={() => copyToClipboard(link)}
          />,
        ]}
      >
        {view === "link" ? (
          <ShareLinkView
            name={name}
            prompt={prompt}
            summaries={summaries}
            link={link}
            onNameChange={setName}
            onPromptChange={setPrompt}
            onSummariesChange={setSummaries}
          />
        ) : (
          <ShareQrView name={name.trim() || mask.name} link={link} />
        )}
      </Modal>
    </div>
  );
}

// Fields for what goes in the link, and the link itself
function ShareLinkView(props: {
  name: string;
  prompt: string;
  summaries: FileSummary[];
  link: string;
  onNameChange: (name: string) => void;
  onPromptChange: (prompt: string) => void;
  onSummariesChange: (summaries: FileSummary[]) => void;
}) {
  const updateSummary = (index: number, summary: string) =>
    props.onSummariesChange(
      props.summaries.map((s, i) => (i === index ? { ...s, summary } : s)),
    );

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
            <label key={i} className={styles["summary"]}>
              <span className={styles["summary-name"]}>{summary.name}</span>
              <Input
                value={summary.summary}
                rows={4}
                onChange={(e) => updateSummary(i, e.currentTarget.value)}
              />
            </label>
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
function ShareQrView(props: { name: string; link: string }) {
  return (
    <div className={styles["qr"]}>
      {props.link.length > MAX_QR_LINK_LENGTH ? (
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
      <div className={`${styles["link"]} ${styles["link-short"]}`}>
        {props.link}
      </div>
    </div>
  );
}
