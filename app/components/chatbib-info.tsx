import { useRef, useState } from "react";
import { IconButton } from "./button";
import { useNavigate } from "react-router-dom";
import { Path } from "../constant";
import Locale from "../locales";
import styles from "./chatbib-info.module.scss";
import content from "./chatbib-info-texts";
import DownIcon from "../icons/down.svg";
import { useChatStore } from "../store";

const introText = (
  <p>
    <p>
      For at understøtte udviklingen af AI-produkter i bibliotekerne har KOMBIT
      og DBC lanceret ChatBib. Projektet er designet til at fremme anvendelsen
      af AI-teknologier i biblioteker gennem praktiske eksperimenter og
      vidensdeling. ChatBib udnytter åbne AI-modeller i et sikkert og
      transparent miljø, som ikke indgår i tech-giganternes forretningsmodeller,
      hvilket beskytter brugernes data.
    </p>
    <p>
      Formålet er at understøtte kompetenceudvikling i bibliotekerne og udforske
      potentialer og begrænsninger ved AI for at kunne udvikle fremtidige
      AI-løsninger i bibliotekssektoren. ChatBib er åbent for alle og kan bruges
      til både professionel udvikling og inspiration i andre offentlige
      sektorer. Projektet sigter også på at sikre høje standarder for
      databeskyttelse og privatliv.
    </p>
    <p>
      ChatBib er i marts 2025 blevet tilrettet således at der er en række
      spørgsmål den ikke vil svare på. Dette er et forsøg og det skal justeres i
      samarbejde med fagfolk for at finde den rigtige balance mellem brugbarhed
      og sikkerhed. Send meget gerne feedback på dette tiltag (brug feedback
      knappen eller skriv til chatbib.feedback@dbc.dk).
    </p>
  </p>
);

interface AccordionItem {
  id: string;
  title: string;
  text: any;
}

interface AccordionProps {
  content: AccordionItem[];
}

const Accordion: React.FC<AccordionProps> = ({ content }) => {
  const [activeId, setActiveId] = useState<string | null>(null);
  const contentRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});

  const handleToggle = (id: string) => {
    setActiveId((prevId) => (prevId === id ? null : id));
  };

  const getContentHeight = (id: string): number => {
    const contentEl = contentRefs.current[id];
    if (contentEl) {
      return contentEl.scrollHeight; // Dynamisk højde af skjult indhold
    }
    return 0;
  };

  return (
    <div className={styles.accordionContainer}>
      {content.map((item) => {
        const isOpen = activeId === item.id;
        const contentHeight = isOpen ? getContentHeight(item.id) : 0;

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

            <div
              ref={(el) => {
                if (el) {
                  contentRefs.current[item.id] = el;
                }
              }}
              className={styles.accordionContent}
              style={{
                maxHeight: `${contentHeight}px`,
                overflow: "hidden",
                transition: "max-height 0.3s ease",
              }}
            >
              <p>{item.text}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
};

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
          <img src="/chatbib/dbclogo.png" style={{ width: "100px" }} />
        </div> */}
        <h1>Velkommen til ChatBib</h1>
        <p>{introText}</p>
        <div className={styles.buttonContainer}>
          <IconButton
            className={styles["new-chat-button"]}
            text={Locale.NewChat.EmptyChat}
            onClick={() => {
              //  chatStore.newSession();
              navigate(Path.NewChat);
            }}
            type="primary"
            shadow
            size={5}
          />
        </div>
        <Accordion content={content} />
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

            <p>
              <a
                className={styles.cookieButton}
                onClick={() => {
                  Cookiebot.show();
                }}
              >
                Administrér cookies
              </a>
            </p>
          </div>

          <div className={styles.logoContainer}>
            <img src="/chatbib/dbclogo.png" style={{ width: "100px" }} />
          </div>
        </footer>
      </div>
    </div>
  );
}
