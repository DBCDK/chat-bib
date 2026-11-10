import { useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { Path } from "../constant";
import { useChatStore } from "../store";
import { Mask, decodeHiddenPrompt, useMaskStore } from "../store/mask";
import { BUILTIN_MASK_STORE } from "../masks";
import { MessageRole } from "../typing";
import { createMessage } from "../store/chat";
import { showToast } from "./ui-lib";
import { FileAttachment } from "../client/api";
import {
  decodeFileSummaries,
  isSameFiles,
  summaryToFile,
} from "../utils/share-summary";

export function JumpToChat() {
  const location = useLocation();
  const [shouldNavigate, setShouldNavigate] = useState(false);
  const chatStore = useChatStore();
  const maskStore = useMaskStore();

  useEffect(() => {
    setShouldNavigate(false);

    const params = new URLSearchParams(location.search);
    const name = params.get("name")?.trim() || undefined;
    const hasEncodedPrompt = params.has("p");
    const encodedPrompt = params.get("p");
    const prompt =
      (hasEncodedPrompt
        ? decodeHiddenPrompt(encodedPrompt ?? "")
        : params.get("prompt")
      )?.trim() || undefined;
    const hideSystemPrompt = params.has("h") || hasEncodedPrompt;

    // A `p` that can't be decoded means the link is broken; don't guess an
    // assistant from the name alone, just open a normal new chat.
    if (hasEncodedPrompt && !prompt) {
      showToast("Linket er ugyldigt. Assistenten kunne ikke åbnes.");
      chatStore.newSession();
      setShouldNavigate(true);
      return;
    }

    // `files`: summaries of the sharer's uploaded files, from the `s` param
    const openChat = (files?: FileAttachment[]) => {
      const builtinMasks = Object.values(BUILTIN_MASK_STORE.masks) as Mask[];
      const allMasks: Mask[] = [...maskStore.getAll(), ...builtinMasks];

      const hasPrompt = (mask: Mask, text: string) =>
        mask.context?.length === 1 &&
        mask.context[0]?.role === MessageRole.System &&
        (mask.context[0]?.content as string | undefined)?.trim() ===
          text.trim();

      const findMatchedMask = (): Mask | undefined => {
        if (!name) return undefined;
        // With summaries, only the same name, prompt and summaries is the same
        // assistant (opening the link again reuses it)
        if (files) {
          return allMasks.find(
            (mask) =>
              !!mask &&
              mask.name === name &&
              hasPrompt(mask, prompt ?? "") &&
              isSameFiles(mask.files, files),
          );
        }
        if (!prompt) return allMasks.find((m) => m?.name === name);

        return allMasks.find(
          (mask) => !!mask && mask.name === name && hasPrompt(mask, prompt),
        );
      };

      const matchedMask = findMatchedMask();
      const maskToUse =
        name && (prompt || files) && !matchedMask
          ? maskStore.create({
              name,
              context: [
                createMessage({
                  role: MessageRole.System,
                  content: prompt ?? "",
                }),
              ],
              files,
              hideSystemPrompt,
            })
          : hideSystemPrompt && matchedMask
            ? { ...matchedMask, builtin: false, hideSystemPrompt: true }
            : matchedMask;

      chatStore.newSession(maskToUse);
      setShouldNavigate(true);
    };

    const encodedSummaries = params.get("s");
    if (encodedSummaries === null) {
      openChat();
      return;
    }

    // Unpacking the summaries is async; a newer run of this effect cancels
    // the older one.
    let cancelled = false;
    decodeFileSummaries(encodedSummaries).then((summaries) => {
      if (cancelled) return;
      // Same as a broken `p`: don't open the assistant without its material,
      // just open a normal new chat.
      if (!summaries) {
        showToast("Linket er ugyldigt. Materialet kunne ikke åbnes.");
        chatStore.newSession();
        setShouldNavigate(true);
        return;
      }
      openChat(summaries.map(summaryToFile));
    });
    return () => {
      cancelled = true;
    };
  }, [location.search, chatStore, maskStore]);

  if (!shouldNavigate) return null;

  return <Navigate to={Path.Chat} replace />;
}
