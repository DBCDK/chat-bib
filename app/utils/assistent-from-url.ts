import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useChatStore } from "../store";
import { createMessage } from "../store/chat";
import { createEmptyMask, Mask, useMaskStore } from "../store/mask";
import { Path } from "../constant";
import { MessageRole } from "../typing";
import { showToast } from "../components/ui-lib";

// Vent til en store er indlæst fra browserens lager,
// ellers kan den nye chat eller assistent blive overskrevet ved indlæsning
async function waitForHydration(store: any) {
  const persist = store.persist;
  if (!persist?.hasHydrated || persist.hasHydrated()) return;
  await new Promise<void>((resolve) => {
    const unsub = persist.onFinishHydration(() => {
      unsub();
      resolve();
    });
  });
}

// Samme navn og samme beskeder (prompt) = samme assistent
function isSameAssistent(a: Mask, b: Mask) {
  return (
    a.name === b.name &&
    a.context.length === b.context.length &&
    a.context.every(
      (m, i) =>
        m.role === b.context[i].role && m.content === b.context[i].content,
    )
  );
}

type LoadedMessage = { role: MessageRole; content: string };

// Læser ?assistent=<url til json>, henter den via /api/assistent
// og åbner en ny chat med assistenten som mask.
// Returnerer true, mens assistenten indlæses.
export function useAssistentFromUrl() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const handled = useRef(false);
  // Sættes allerede ved første render, så forsiden ikke når at blive vist
  const [loading, setLoading] = useState(() => searchParams.has("assistent"));

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

        await Promise.all([
          waitForHydration(useChatStore),
          waitForHydration(useMaskStore),
        ]);

        // Gem assistenten under "Assistenter", så den kan åbnes igen senere.
        // Er den allerede gemt (samme navn og prompt), genbruges den.
        const maskStore = useMaskStore.getState();
        const savedMask =
          maskStore
            .getAll()
            .find((m) => !m.builtin && isSameAssistent(m, mask)) ??
          maskStore.create(mask);

        const chatStore = useChatStore.getState();
        chatStore.newSession(savedMask);
        // Titlen sættes til assistentens navn, så auto-titlen ikke overskriver den
        chatStore.updateCurrentSession((session) => {
          session.topic = savedMask.name;
        });
        navigate(Path.Chat, { replace: true });
      } catch {
        showToast("Assistenten kunne ikke indlæses");
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  return loading;
}