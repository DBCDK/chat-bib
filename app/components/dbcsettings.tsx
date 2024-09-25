/* eslint-disable @next/next/no-img-element */
import { useState } from "react";
import styles from "./dbcsettings.module.scss";
import { BaseSelector, Modal } from "./ui-lib";
import { ModelType, useChatStore } from "../store";
import { IconButton } from "./button";
import { MODEL_NAMES } from "../dbc";
import { PERSONAS } from "../personas";
import SettingsIcon from "../icons/chat-settings.svg";

const MODEL_VARIANT_DESCRIPTIONS: any = {
  [MODEL_NAMES.DBC_MULTI_SEARCH]: {
    title: "Hele beskedhistorik",
    subTitle: (
      <div>
        <p>
          Denne variant anvender hele beskedhistorikken til at udforme
          søgninger. Den kan skabe mere præcise søgninger ved at tage alle
          tidligere beskeder i betragtning. Den kan dog komme til at fokusere på
          ældre, irrelevante beskeder, som ikke længere er vigtige.
        </p>
      </div>
    ),
  },
  [MODEL_NAMES.DBC_MULTI_SEARCH_NO_CONTEXT]: {
    title: "Kun seneste besked",
    subTitle: (
      <div>
        <p>
          Denne variant benytter kun brugerens seneste besked til at udforme
          søgninger. Den er bedre til at skifte emne, da den kun fokuserer på
          den nyeste besked. Der er dog en risiko for at en meningsfuld søgning
          ikke kan foretages, da der kan mangle kontekst fra tidligere beskeder.
        </p>
      </div>
    ),
  },
};

/**
 * A settings modal used for DBC's models/sessions
 */
export function DbcSettings() {
  const chatStore = useChatStore();
  const [showModelSelector, setShowModelSelector] = useState(false);

  const mask = chatStore.currentSession().mask;
  // switch model
  const currentModel = mask.modelConfig.model;

  // Models available in session for this persona
  const availableModels = mask.availableModels;

  // Selected persona
  const persona = PERSONAS.find((persona) => persona.mask.id === mask.id);

  // If there are no available models to pick from, we don't show the settings button
  if (!availableModels) {
    return null;
  }

  return (
    <>
      <IconButton
        className={styles.settingsbutton}
        text={"Indstillinger"}
        icon={<SettingsIcon />}
        key="feedback"
        onClick={() => {
          setShowModelSelector(true);
        }}
      />
      {showModelSelector && (
        <div className={`modal-mask ${styles.modal}`}>
          <Modal
            title={"Indstillinger"}
            onClose={() => setShowModelSelector(false)}
          >
            <h3>{persona?.name}</h3>
            <p className={styles.description}>{persona?.description}</p>
            <BaseSelector
              defaultSelectedValue={currentModel}
              items={
                availableModels?.map((m) => ({
                  ...MODEL_VARIANT_DESCRIPTIONS[m],
                  value: m,
                })) || []
              }
              onSelection={(s) => {
                if (s.length === 0) return;
                chatStore.updateCurrentSession((session) => {
                  session.mask.modelConfig.model = s[0] as ModelType;
                  session.mask.syncGlobalConfig = false;
                });
                // showToast(s[0]);
              }}
            />
          </Modal>
        </div>
      )}
    </>
  );
}
