import { useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { Path } from "../constant";
import { useChatStore } from "../store";
import { Mask, useMaskStore } from "../store/mask";
import { BUILTIN_MASK_STORE } from "../masks";
import { MessageRole } from "../typing";
import { createMessage } from "../store/chat";

export function JumpToChat() {
  const location = useLocation();
  const [shouldNavigate, setShouldNavigate] = useState(false);
  const chatStore = useChatStore();
  const maskStore = useMaskStore();

  useEffect(() => {
    setShouldNavigate(false);

    const params = Object.fromEntries(
      new URLSearchParams(location.search).entries(),
    );

    const name = params.name?.trim();
    const prompt = params.prompt?.trim();
    const allMasks: Mask[] = [
      ...maskStore.getAll(),
      ...(Object.values(BUILTIN_MASK_STORE.masks) as unknown as Mask[]),
    ];
    const matchedMask: Mask | undefined =
      name && prompt
        ? allMasks.find((m) => {
            if (!m || m.name !== name) return false;
            const systemPrompts = (m.context ?? []).filter(
              (msg) => msg?.role === MessageRole.System,
            );
            const systemPromptContent = systemPrompts[0]?.content;
            const systemPromptText =
              typeof systemPromptContent === "string"
                ? systemPromptContent.trim()
                : undefined;
            return systemPrompts.length === 1 && systemPromptText === prompt;
          })
        : name
          ? allMasks.find((m) => m?.name === name)
          : undefined;

    const maskToUse: Mask | undefined =
      name && prompt && !matchedMask
        ? maskStore.create({
            name,
            context: [
              createMessage({ role: MessageRole.System, content: prompt }),
            ],
          })
        : matchedMask;

    chatStore.newSession(maskToUse);
    setShouldNavigate(true);
  }, [location.search, chatStore, maskStore]);

  if (!shouldNavigate) return null;

  return <Navigate to={Path.Chat} replace />;
}
