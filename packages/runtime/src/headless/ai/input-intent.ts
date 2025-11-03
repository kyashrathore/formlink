import { parsePhoneNumberFromString } from "libphonenumber-js";

export type InputIntent = "tel" | "email" | "url" | "number";

export type IntentResult = {
  intent: InputIntent | null;
  confidence: number; // 0..1
  valid: boolean | null; // null when unknown
  normalized?: string;
  reason?: string;
  country?: string | null; // ISO2 when tel
  dialCode?: string | null; // when tel
};

// RFC-like strict email (still pragmatic). Requires at least one dot in domain and TLD >= 2.
const EMAIL_STRICT =
  /^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9]))+$/;
const NUMBER_SOFT = /^-?\d{1,3}(?:[\s,]?\d{3})*(?:\.\d+)?$/; // forgiving with grouping
const URL_LIKE = /^(https?:\/\/|www\.)|^[^\s]+\.[a-z]{2,}(?:\/|$)/i;

export function detectInputIntent(text: string): IntentResult {
  const value = (text || "").trim();
  if (!value) return { intent: null, confidence: 0, valid: null };

  // TEL
  if (/^[+\d][\d\s()\-]*$/.test(value)) {
    const parsed = safeParsePhone(value);
    if (parsed) {
      return {
        intent: "tel",
        confidence: 0.95,
        valid: parsed.isValid,
        country: parsed.country || null,
        dialCode: parsed.dialCode || null,
        normalized: parsed.e164,
        reason: parsed.isValid ? "valid-e164" : "invalid-e164",
      };
    }
    // Looks like a phone attempt but not parseable yet
    const dial = extractDialCode(value);
    return {
      intent: "tel",
      confidence: dial ? 0.85 : 0.6,
      valid: null,
      dialCode: dial,
      reason: "pattern-like-tel",
    };
  }

  // EMAIL — treat as intent only when the entire input looks like an email attempt (single token)
  if (value.includes("@")) {
    // If spaces exist, assume narrative text rather than intent (e.g., "email me @ john")
    if (/\s/.test(value)) {
      return { intent: null, confidence: 0.3, valid: null };
    }
    // Leading @mention (no dot in domain) → likely a mention, not email
    if (/^@[A-Za-z0-9_.-]+$/.test(value) && !/\./.test(value)) {
      return { intent: null, confidence: 0.3, valid: null };
    }

    // Strict check
    const parts = value.split("@");
    if (EMAIL_STRICT.test(value) && parts[0] && !parts[0].includes("..")) {
      const local = parts[0] || "";
      const domain = parts[1] || "";
      const validLocal = !local.startsWith(".") && !local.endsWith(".");
      const validDomain = !domain.startsWith("-") && !domain.endsWith("-");
      if (validLocal && validDomain) {
        return {
          intent: "email",
          confidence: 0.95,
          valid: true,
          normalized: `${local}@${domain.toLowerCase()}`,
          reason: "email-strict",
        };
      }
    }

    // Common incomplete/invalid patterns that still indicate email intent
    if (/^[^\s@]+@[^\s@]+$/.test(value)) {
      return {
        intent: "email",
        confidence: 0.85,
        valid: false,
        reason: "email-missing-tld",
      };
    }
    if (/^[^\s@]+@[^\s@]+\.[A-Za-z]{1}$/.test(value)) {
      return {
        intent: "email",
        confidence: 0.85,
        valid: false,
        reason: "email-short-tld",
      };
    }

    // If it contains @ but doesn’t match credible patterns, do not claim email intent
    return { intent: null, confidence: 0.4, valid: null };
  }

  // URL
  if (URL_LIKE.test(value)) {
    const normalized = value.startsWith("http") ? value : `https://${value}`;
    try {
      const u = new URL(normalized);
      const ok = Boolean(u.hostname && u.hostname.includes("."));
      return {
        intent: "url",
        confidence: ok ? 0.9 : 0.7,
        valid: ok,
        normalized: ok ? normalized : undefined,
        reason: ok ? "url-ok" : "url-suspect",
      };
    } catch {
      return {
        intent: "url",
        confidence: 0.7,
        valid: false,
        reason: "url-parse-failed",
      };
    }
  }

  // NUMBER
  if (/^-?[\d\s,]*\.?\d+$/.test(value)) {
    const basic = NUMBER_SOFT.test(value);
    return {
      intent: "number",
      confidence: basic ? 0.85 : 0.7,
      valid: basic,
      reason: basic ? "number-basic" : "number-suspect",
    };
  }

  return { intent: null, confidence: 0.2, valid: null };
}

export function extractDialCode(text: string): string | null {
  const m = String(text || "").match(/^(?:\+|00)(\d{1,4})/);
  return m ? "+" + m[1] : null;
}

function safeParsePhone(text: string): {
  isValid: boolean;
  e164?: string;
  country?: string;
  dialCode?: string;
} | null {
  try {
    const p = parsePhoneNumberFromString(text);
    if (!p) return null;
    return {
      isValid: p.isValid(),
      e164: p.number,
      country: p.country || undefined,
      dialCode: "+" + String(p.countryCallingCode || ""),
    };
  } catch {
    return null;
  }
}
