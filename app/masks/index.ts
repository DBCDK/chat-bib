import { Mask } from "../store/mask";

import { env } from "../utils/appsettings";
import { CHATDBC_MASKS } from "./chatdbc";
import { SKOLEGPT_MASKS } from "./skolegpt";

import { type BuiltinMask } from "./typing";
export { type BuiltinMask } from "./typing";

export const BUILTIN_MASK_ID = 100000;

export const BUILTIN_MASK_STORE = {
  buildinId: BUILTIN_MASK_ID,
  masks: {} as Record<string, BuiltinMask>,
  get(id?: string) {
    if (!id) return undefined;
    return this.masks[id] as Mask | undefined;
  },
  add(m: BuiltinMask) {
    const mask = { ...m, id: this.buildinId++, builtin: true };
    this.masks[mask.id] = mask;
    return mask;
  },
};

const SOURCE_BUILTIN_MASKS =
  env.BUILTIN_MASK_PROFILE === "chatdbc" ? CHATDBC_MASKS : SKOLEGPT_MASKS;

export const BUILTIN_MASKS: BuiltinMask[] = [...SOURCE_BUILTIN_MASKS].map((m) =>
  BUILTIN_MASK_STORE.add(m),
);
