export type Updater<T> = (updater: (value: T) => void) => void;

export const ROLES = ["system", "user", "assistant"] as const;
//export type MessageRole = (typeof ROLES)[number];
export enum MessageRole {
  System = "system",
  Assistant = "assistant",
  User = "user",
}
export interface RequestMessage {
  role: MessageRole;
  content: string;
}
