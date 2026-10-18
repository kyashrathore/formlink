const ALPHABET = "0123456789abcdefghjkmnpqrstvwxyz";

export function randomString(length: number): string {
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  let out = "";
  for (const b of bytes) out += ALPHABET[b % 32];
  return out;
}

export type IdPrefix = "ws" | "key" | "frm" | "sub" | "fil" | "run" | "ver" | "sit" | "dep";

export const newId = (prefix: IdPrefix) => `${prefix}_${randomString(20)}`;

export const now = () => Date.now();
