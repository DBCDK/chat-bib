import { useState, useEffect } from "react";
import { IconButton } from "./button";
import { useLocation, useNavigate } from "react-router-dom";
import { Path } from "../constant";
import Locale from "../locales";
import styles from "./chatbib-info.module.scss";
import content from "./chatbib-info-texts.json";
const introText =
  "For at understøtte udviklingen af AI-produkter i bibliotekerne har KOMBIT og DBC lanceret ChatBib. Projektet er designet til at fremme anvendelsen af AI-teknologier i biblioteker gennem praktiske eksperimenter og vidensdeling. ChatBib udnytter åbne AI-modeller i et sikkert og transparent miljø, som ikke indgår i tech-giganternes forretningsmodeller, hvilket beskytter brugernes data. Formålet er at udforske potentialer og begrænsninger ved AI for at kunne udvikle fremtidige AI-løsninger i bibliotekssektoren. ChatBib er åbent for alle og kan bruges til både professionel udvikling og inspiration i andre offentlige sektorer. Projektet sigter også på at sikre høje standarder for databeskyttelse og privatliv.";

export function ChatbibIntro() {
  const navigate = useNavigate();
  return (
    <div className={styles.container}>
      <div className={styles.content}>
        <div>
          <h1>Velkommen til ChatBib</h1>
          <p>{introText}</p>
        </div>

        <IconButton
          className={styles["new-chat-button"]}
          text={Locale.NewChat.EmptyChat}
          onClick={() => navigate(Path.NewChat)}
          type="primary"
          shadow
          size={5}
        />
        {content.map((item) => (
          <div className={styles.contentItem} key={item.id}>
            <h2>{item.title}</h2>
            <p>{introText}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
