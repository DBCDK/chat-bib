/* eslint-disable @next/next/no-img-element */
import { useRef, useState } from "react";
import Locale from "../locales";
import styles from "./feedback.module.scss";
import { Modal, showToast } from "./ui-lib";
import { useAppConfig, useChatStore } from "../store";
import { IconButton } from "./button";
import { CheckButton } from "./settings";

export function FeedbackModal(props: {
  chatRef: React.RefObject<HTMLDivElement>;
  onClose: () => void;
}) {
  const config = useAppConfig();
  const chatStore = useChatStore();
  const session = chatStore.currentSession();

  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [feedbackText, setFeedbackText] = useState("");
  const [attachScreenshot, setAttachScreenshot] = useState(true);

  const handleSendFeedback = async () => {
    const messages = session?.messages;
    const chatHtml = props.chatRef.current?.innerHTML || "";

    if (feedbackText.trim() === "") {
      alert("Please enter your feedback before submitting.");
      return;
    }
    try {
      const response = await fetch("/api/feedback", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          feedbackText: feedbackText,
          messages: attachScreenshot ? JSON.stringify(messages) : [],
          chatHtml: attachScreenshot ? chatHtml : "",
        }),
      });

      if (response.ok) {
        showToast("Tak for din feedback!");
        setFeedbackText(""); // Clear the input after submission
        props.onClose(); // Close the modal after successful submission
      } else {
        showToast("Noget gik galt. Prøv igen.");
      }
    } catch (error) {
      console.error("Error submitting feedback:", error);
      showToast("Noget gik galt. Prøv igen.");
    }
  };

  return (
    <div className="modal-mask">
      <Modal
        title={Locale.Feedback.Title}
        onClose={props.onClose}
        // footer={
        //   <div
        //     style={{
        //       width: "100%",
        //       textAlign: "center",
        //       fontSize: 14,
        //       opacity: 0.5,
        //     }}
        //   >
        //     {Locale.Exporter.Description.Title}
        //   </div>
        // }
      >
        <div className={styles.contentContainer}>
          <p>
            Vi vil gerne høre din mening. Del din feedback og hjælp os med at
            forbedre ChatBib.
          </p>
          <textarea
            id="chat-input"
            ref={inputRef}
            className={styles["chat-input"]}
            placeholder={Locale.Feedback.Placeholder}
            onInput={(e) => setFeedbackText(e.currentTarget.value)}
            value={feedbackText}
            rows={5}
            autoFocus={true}
            style={{
              fontSize: config.fontSize,
            }}
          />
          <div
            className={styles.checkboxContainer}
            onClick={() => {
              setAttachScreenshot(!attachScreenshot);
            }}
          >
            <input
              className={styles.checkbox}
              type="checkbox"
              checked={attachScreenshot}
            ></input>
            <p>{Locale.Feedback.CheckboxText}</p>
          </div>
          <IconButton
            className={styles.submit}
            size={4}
            //    icon={<AddIcon  />}
            text={Locale.Feedback.Submit}
            onClick={() => {
              //send feedback via email

              handleSendFeedback();
            }}
            shadow
          />
        </div>
      </Modal>
    </div>
  );
}
