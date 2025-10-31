"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import styles from "./chat.module.scss";
import { IconButton } from "./button";
import SendWhiteIcon from "../icons/send-white.svg";
import StopIcon from "../icons/pause.svg";
import { useAppConfig, useChatStore } from "../store";
import { getMessageTextContent, trackMatomoEvent } from "../utils";
import { Markdown } from "./markdown";
import { PERSONAS, MULTICHAT_PERSONAS_EXTRA } from "../personas";
import { ChatControllerPool } from "../client/controller";
import { useLocation } from "react-router-dom";

type Pane = {
  personaName: string;
  sessionId: string;
};

function MessagePane(props: { pane: Pane }) {
  const { pane } = props;
  const chatStore = useChatStore();
  const session = chatStore.getSessionById(pane.sessionId);
  const messages = session?.messages ?? [];
  const isStreaming = messages.some((m) => m.streaming);

  return (
    <div className={styles["chat-messages-container"]}>
      <div className={styles["section-title"]}>
        <div>{pane.personaName}</div>
        {isStreaming && (
          <IconButton
            text="Stop"
            icon={<StopIcon />}
            onClick={() => {
              // stop last streaming message in this session
              const last = [...messages].reverse().find((m) => m.streaming);
              if (last) ChatControllerPool.stop(pane.sessionId, last.id);
            }}
          />
        )}
      </div>

      {[...messages].map((message) => {
        const isUser = message.role === "user" || message.role === "User";
        return (
          <div
            key={message.id}
            className={`${styles["chat-message"]} ${isUser ? styles["chat-message-user"] : ""}`}
          >
            <div className={styles["chat-message-container"]}>
              <div className={styles["chat-message-item"]}>
                <Markdown content={getMessageTextContent(message)} loading={message.streaming} />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function MultiChat() {
  const chatStore = useChatStore();
  const config = useAppConfig();
  const [userInput, setUserInput] = useState("");
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const location = useLocation();

  // Initialize persona sessions once per mount to avoid infinite loops
  const initializedRef = useRef(false);
  const [personaToSession, setPersonaToSession] = useState<Map<string, string>>(new Map());
  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;

    const state = (location && (location as any).state) || {};
    const fresh = !!state?.fresh;
    const map = new Map<string, string>();

    const multichatPersonas = [...PERSONAS, ...MULTICHAT_PERSONAS_EXTRA];

    if (fresh) {
      multichatPersonas.forEach((p) => {
        const id = chatStore.newSessionNoSelect(p.mask);
        map.set(p.name, id);
      });
    } else {
      multichatPersonas.forEach((p) => {
        const existing = chatStore.sessions.find((s) => s.mask?.name === p.mask.name);
        if (existing) {
          map.set(p.name, existing.id);
        }
      });
      multichatPersonas.forEach((p) => {
        if (!map.has(p.name)) {
          const id = chatStore.newSessionNoSelect(p.mask);
          map.set(p.name, id);
        }
      });
    }

    setPersonaToSession(map);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const panes: Pane[] = useMemo(
    () => Array.from(personaToSession.entries()).map(([personaName, sessionId]) => ({ personaName, sessionId })),
    [personaToSession],
  );

  const doSubmit = () => {
    const text = userInput.trim();
    if (!text) return;
    panes.forEach((pane) => {
      chatStore.onUserInputForSession(pane.sessionId, text);
      trackMatomoEvent("MultiChat", "Send message", pane.personaName);
    });
    setUserInput("");
    inputRef.current?.focus();
  };

  return (
    <div className={styles["chat"]}>
      <div className={styles["chat-body"]}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
            gap: 16,
            width: "100%",
            maxWidth: 1200,
          }}
        >
          {panes.map((pane) => (
            <div
              key={pane.sessionId}
              style={{
                border: "var(--border-in-light)",
                borderRadius: 10,
                padding: 8,
                background: "var(--white)",
                color: "var(--black)",
                height: 480,
                overflowY: "auto",
                display: "flex",
                flexDirection: "column",
              }}
            >
              <MessagePane pane={pane} />
            </div>
          ))}
        </div>
      </div>

      <div className={styles["chat-input-panel-container"]}>
        <div className={styles["chat-input-panel"]}>
          <div className={`${styles["chat-input-panel-inner"]}`}>
            <textarea
              ref={inputRef}
              className={styles["chat-input"]}
              placeholder="Skriv din besked..."
              value={userInput}
              onChange={(e) => setUserInput(e.currentTarget.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  doSubmit();
                }
              }}
            />
            <IconButton
              icon={<SendWhiteIcon />}
              text="Send"
              className={styles["chat-input-send"]}
              type="primary"
              onClick={doSubmit}
            />
          </div>
        </div>
      </div>
    </div>
  );
}


