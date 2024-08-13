import { useState } from "react";
import { IconButton } from "./button";
import { useNavigate } from "react-router-dom";
import { Path } from "../constant";
import Locale from "../locales";
import styles from "./chatbib-info.module.scss";
import content from "./chatbib-info-texts.json";
import DownIcon from "../icons/down.svg";
import { useChatStore } from "../store";

const introText =
  "For at understøtte udviklingen af AI-produkter i bibliotekerne har KOMBIT og DBC lanceret ChatBib. Projektet er designet til at fremme anvendelsen af AI-teknologier i biblioteker gennem praktiske eksperimenter og vidensdeling. ChatBib udnytter åbne AI-modeller i et sikkert og transparent miljø, som ikke indgår i tech-giganternes forretningsmodeller, hvilket beskytter brugernes data. Formålet er at udforske potentialer og begrænsninger ved AI for at kunne udvikle fremtidige AI-løsninger i bibliotekssektoren. ChatBib er åbent for alle og kan bruges til både professionel udvikling og inspiration i andre offentlige sektorer. Projektet sigter også på at sikre høje standarder for databeskyttelse og privatliv.";

export function ChatbibIntro() {
  const navigate = useNavigate();
  const [activeId, setActiveId] = useState<string | null>(null);
  const chatStore = useChatStore();

  const handleToggle = (id: string) => {
    setActiveId(activeId === id ? null : id);
  };

  return (
    <div className={styles.container}>
      <div className={styles.content}>
        {/* <div className={styles.logoContainer}>
          <img src="/dbclogo.png" style={{ width: "100px" }} />
        </div> */}
        <h1>Velkommen til ChatBib</h1>
        <p>{introText}</p>
        <div className={styles.buttonContainer}>
          <IconButton
            className={styles["new-chat-button"]}
            text={Locale.NewChat.EmptyChat}
            onClick={() => {
              chatStore.newSession();
              navigate(Path.NewChat);
            }}
            type="primary"
            shadow
            size={5}
          />
        </div>
        <div className={styles.accordionContainer}>
          {content.map((item) => {
            const isOpen = activeId === item.id;
            return (
              <div
                className={`${styles.contentItem} ${isOpen ? styles.isOpen : ""}`}
                key={item.id}
                id={item.id}
                onClick={() => handleToggle(item.id)}
              >
                <div className={styles.accordionTitle}>
                  <h3>{item.title}</h3>
                  <DownIcon className={styles.arrowIcon} />
                </div>

                {isOpen && <p>{item.text}</p>}
              </div>
            );
          })}
        </div>
        <footer className={styles.footer}>
          <div>
            <h4>Kontakt</h4>
            <p>
              DBC DIGITAL A/S
              <br /> Tempovej 7-11
              <br /> 2750 Ballerup
              <br />
              <a href="mailto:dbc@dbc.dk">dbc@dbc.dk</a>
            </p>
          </div>
          <div>
            <h4>Kundeservice</h4>
            <p>
              <a
                className="external-link"
                href="http://kundeservice.dbc.dk"
                target="_blank"
              >
                DBC's kundeservice
                <br />
                Servicedesk for driftskunder
              </a>
              <br />
            </p>
          </div>

          <div className={styles.logoContainer}>
            <img src="/dbclogo.png" style={{ width: "100px" }} />
          </div>
        </footer>
      </div>
    </div>
  );
}
