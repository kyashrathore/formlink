const enc = new TextEncoder();
const dec = new TextDecoder();

export function toBase64(bytes: ArrayBuffer | Uint8Array): string {
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let s = "";
  for (const b of arr) s += String.fromCharCode(b);
  return btoa(s);
}

export function fromBase64(b64: string): Uint8Array {
  const s = atob(b64);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

const toBase64Url = (bytes: ArrayBuffer | Uint8Array) =>
  toBase64(bytes).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const fromBase64Url = (s: string) =>
  fromBase64(s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4));

export async function sha256(input: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", enc.encode(input));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function aesKey(secretsKey: string) {
  return crypto.subtle.importKey("raw", fromBase64(secretsKey), "AES-GCM", false, [
    "encrypt",
    "decrypt",
  ]);
}

export async function encryptSecret(secretsKey: string, plaintext: string) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    await aesKey(secretsKey),
    enc.encode(plaintext),
  );
  return { ciphertext: toBase64(ct), iv: toBase64(iv) };
}

export async function decryptSecret(secretsKey: string, ciphertext: string, iv: string) {
  const pt = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: fromBase64(iv) },
    await aesKey(secretsKey),
    fromBase64(ciphertext),
  );
  return dec.decode(pt);
}

async function hmacKey(signingKey: string) {
  return crypto.subtle.importKey("raw", enc.encode(signingKey), { name: "HMAC", hash: "SHA-256" }, false, [
    "sign",
    "verify",
  ]);
}

/** Compact signed token: base64url(json).base64url(hmac). Carries its own `exp` (ms). */
export async function signToken(signingKey: string, payload: Record<string, unknown>): Promise<string> {
  const body = toBase64Url(enc.encode(JSON.stringify(payload)));
  const sig = await crypto.subtle.sign("HMAC", await hmacKey(signingKey), enc.encode(body));
  return `${body}.${toBase64Url(sig)}`;
}

export async function verifyToken<T extends { exp: number }>(
  signingKey: string,
  token: string,
): Promise<T | null> {
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  let ok = false;
  try {
    ok = await crypto.subtle.verify("HMAC", await hmacKey(signingKey), fromBase64Url(sig), enc.encode(body));
  } catch {
    return null;
  }
  if (!ok) return null;
  const payload = JSON.parse(dec.decode(fromBase64Url(body))) as T;
  return payload.exp > Date.now() ? payload : null;
}

/** Stripe-style webhook signature check (t=...,v1=...). */
export async function hmacHex(key: string, message: string): Promise<string> {
  const sig = await crypto.subtle.sign("HMAC", await hmacKey(key), enc.encode(message));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
