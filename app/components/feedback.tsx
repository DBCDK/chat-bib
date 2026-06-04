import { RefObject, useMemo, useState } from "react";
import styles from "./feedback.module.scss";
import { IconButton } from "./button";
import { Modal, showToast } from "./ui-lib";
import Locale from "../locales";
import { useChatStore } from "../store";

export function FeedbackModal(props: {
  chatRef: RefObject<HTMLDivElement>;
  onClose: () => void;
}) {
  const chatStore = useChatStore();
  const session = chatStore.currentSession();
  const [feedbackText, setFeedbackText] = useState("");
  const [attachConversation, setAttachConversation] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const messages = useMemo(
    () =>
      attachConversation
        ? session.messages.map((message) => ({
            role: message.role,
            content: message.content,
            date: message.date,
          }))
        : [],
    [attachConversation, session.messages],
  );

  const handleSendFeedback = async () => {
    if (feedbackText.trim() === "") {
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch("/api/feedback", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          feedbackText,
          messages,
          maskName: session.mask.name,
        }),
      });

      if (!response.ok) {
        throw new Error(`Feedback request failed: ${response.status}`);
      }

      showToast("Tak for din feedback!");
      setFeedbackText("");
      props.onClose();
    } catch (error) {
      console.error("Error sending feedback:", error);
      showToast(Locale.Feedback.Error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="modal-mask">
      <Modal
        title={Locale.Feedback.Title}
        onClose={props.onClose}
        actions={[
          <IconButton
            key="submit"
            text={Locale.Feedback.Submit}
            bordered
            disabled={isSubmitting || feedbackText.trim() === ""}
            onClick={handleSendFeedback}
          />,
        ]}
      >
        <div className={styles.content}>
          <p className={styles.description}>
            Vi vil gerne høre din mening. Del din feedback og hjælp os med at
            gøre ChatBib bedre.
          </p>
          <textarea
            className={styles.textarea}
            placeholder={Locale.Feedback.Placeholder}
            onInput={(e) => setFeedbackText(e.currentTarget.value)}
            value={feedbackText}
          />
          <label className={styles.checkbox}>
            <input
              type="checkbox"
              checked={attachConversation}
              onChange={(e) => setAttachConversation(e.currentTarget.checked)}
            />
            <p>{Locale.Feedback.CheckboxText}</p>
          </label>
        </div>
      </Modal>
    </div>
  );
}
