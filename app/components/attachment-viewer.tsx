import { useEffect, useState } from "react";
import { FileAttachment } from "../client/api";
import { loadFileBlob } from "../utils/file-store";
import { Modal } from "./ui-lib";
import styles from "./chat.module.scss";

// Shows one file in a big preview. Pictures are shown as a picture. Everything
// else is shown in a frame. That is how pdf files get opened. Pass null to keep
// the preview closed.
//
// Files that are saved in IndexedDB are found by their id and get a temporary
// link made here. Pictures and older files already have their own link.
export function AttachmentViewer(props: {
  attachment: FileAttachment | null;
  onClose: () => void;
}) {
  const attachment = props.attachment;
  const [url, setUrl] = useState("");

  useEffect(() => {
    if (!attachment) {
      setUrl("");
      return;
    }
    if (attachment.url) {
      setUrl(attachment.url);
      return;
    }
    if (!attachment.id) {
      setUrl("");
      return;
    }
    let objectUrl = "";
    let cancelled = false;
    loadFileBlob(attachment.id).then((blob) => {
      if (cancelled || !blob) return;
      objectUrl = URL.createObjectURL(blob);
      setUrl(objectUrl);
    });
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [attachment]);

  if (!attachment) return null;

  return (
    <div className="modal-mask">
      <Modal
        title={attachment.name || "Vedhæftning"}
        defaultMax={true}
        onClose={props.onClose}
      >
        <div className={styles["attachment-viewer"]}>
          {!url ? (
            <p>Filen kan ikke længere vises.</p>
          ) : attachment.mime.startsWith("image/") ? (
            <img src={url} alt="" />
          ) : (
            <iframe
              className={styles["attachment-viewer-frame"]}
              src={url}
              title={attachment.name}
            />
          )}
        </div>
      </Modal>
    </div>
  );
}
