import { useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useChatStore } from "../store";
import { createMessage } from "../store/chat";
import { createEmptyMask, Mask } from "../store/mask";
import { Path } from "../constant";
import { MessageRole } from "../typing";
import { showToast } from "./ui-lib";

// Vent til chat-store er indlæst fra browserens lager,
// ellers kan den nye chat blive overskrevet ved indlæsning
async function waitForChatStore() {
  const persist = (useChatStore as any).persist;
  if (!persist?.hasHydrated || persist.hasHydrated()) return;
  await new Promise<void>((resolve) => {
    const unsub = persist.onFinishHydration(() => {
      unsub();
      resolve();
    });
  });
}

type LoadedMessage = { role: MessageRole; content: string };

// Læser ?assistent=<url til json>, henter den via /api/assistent
// og åbner en ny chat med assistenten som mask.
export function useAssistentFromUrl() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const handled = useRef(false);

  useEffect(() => {
    const src = searchParams.get("assistent");
    if (!src || handled.current) return;
    handled.current = true; // beskytter mod dobbelt-kørsel i StrictMode

    // Fjern parameteren, så et reload ikke opretter endnu en chat
    const next = new URLSearchParams(searchParams);
    next.delete("assistent");
    setSearchParams(next, { replace: true });

    (async () => {
      try {
        const res = await fetch(
          `/api/assistent?src=${encodeURIComponent(src)}`,
        );
        if (!res.ok) throw new Error(String(res.status));
        const data = await res.json();

        const empty = createEmptyMask();
        const mask = {
          ...empty,
          name: data.name,
          avatar: data.avatar,
          lang: data.lang ?? empty.lang,
          hideContext: data.hideContext,
          context: (data.context as LoadedMessage[]).map((m) =>
            createMessage({ role: m.role, content: m.content }),
          ),
          modelConfig: { ...empty.modelConfig, ...(data.modelConfig ?? {}) },
          // Følger filens valg; uden værdi i filen bruges filens modelConfig
          syncGlobalConfig: data.syncGlobalConfig ?? !data.modelConfig,
        } as Mask;

        await waitForChatStore();
        const chatStore = useChatStore.getState();
        chatStore.newSession(mask);
        // Titlen sættes til assistentens navn, så auto-titlen ikke overskriver den
        chatStore.updateCurrentSession((session) => {
          session.topic = mask.name;
        });
        navigate(Path.Chat, { replace: true });
      } catch {
        showToast("Assistenten kunne ikke indlæses");
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);
}