import { useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { Path } from "../constant";
import { useChatStore } from "../store";
import { Mask, useMaskStore } from "../store/mask";
import { BUILTIN_MASK_STORE } from "../masks";

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
    console.log(params);

    const name = params.name?.trim();
    const allMasks: Mask[] = [
      ...maskStore.getAll(),
      ...(Object.values(BUILTIN_MASK_STORE.masks) as unknown as Mask[]),
    ];
    const matchedMask: Mask | undefined = name
      ? allMasks.find((m) => m?.name === name)
      : undefined;

    chatStore.newSession(matchedMask);
    setShouldNavigate(true);
    // maskStore/chatStore are stable (zustand), but included to satisfy hooks lint
  }, [location.search, chatStore, maskStore]);

  if (!shouldNavigate) return null;

  return <Navigate to={Path.Chat} replace />;
}
