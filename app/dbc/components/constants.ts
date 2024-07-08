export const BEGIN_COMPONENT = "<C>";
export const END_COMPONENT = "</C>";
export const DELIMITER = "_";
export function encodeValue(str: string): string {
  return str.replace(/_/g, "%_");
}

export function decodeValue(str: string): string {
  return str.replace(/%_/g, "_");
}
