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

    const params = new URLSearchParams(location.search);
    const name = params.get("name")?.trim() || undefined;
    const prompt = params.get("prompt")?.trim() || undefined;
    // notes made from files by the person who shared this assistant
    const material = params.get("material")?.trim() || undefined;

    const builtinMasks = Object.values(BUILTIN_MASK_STORE.masks) as Mask[];
    const allMasks: Mask[] = [...maskStore.getAll(), ...builtinMasks];

    const findMatchedMask = (): Mask | undefined => {
      if (!name) return undefined;
      if (!prompt) return allMasks.find((m) => m?.name === name);

      return allMasks.find(
        (mask) =>
          !!mask &&
          mask.name === name &&
          (prompt === undefined ||
            (mask.context?.length === 1 &&
              mask.context[0]?.role === MessageRole.System &&
              (mask.context[0]?.content as string | undefined)?.trim() ===
                prompt.trim())),
      );
    };

    const matchedMask = findMatchedMask();
    const maskToUse =
      name && prompt && !matchedMask
        ? maskStore.create({
            name,
            context: [
              createMessage({ role: MessageRole.System, content: prompt }),
            ],
            materials: material
              ? [{ name: "Delt materiale", text: material }]
              : undefined,
          })
        : matchedMask;

    chatStore.newSession(maskToUse);
    setShouldNavigate(true);
  }, [location.search, chatStore, maskStore]);

  if (!shouldNavigate) return null;

  return <Navigate to={Path.Chat} replace />;
}
