import type { Question } from "@formlink/schema";

export type QuestionResponse = unknown;

export function formatResponseForDisplay(
  question: Question,
  response: QuestionResponse,
): string {
  if (response == null) return "";

  switch (question.type.name) {
    case "singleChoice":
    case "multipleChoice": {
      const values = Array.isArray(response) ? response : [response];
      const options = (question.type as any)?.options as
        | Array<{ value: string; label: string }>
        | undefined;
      const labels = values.map((v) => {
        const label = options?.find((o) => o.value === v)?.label;
        return String(label ?? v);
      });
      return labels.join(", ");
    }
    case "address": {
      if (typeof response === "object" && response) {
        const addr = response as any;
        const parts: string[] = [];
        if (addr.street1) parts.push(addr.street1);
        if (addr.street2) parts.push(addr.street2);
        if (addr.city) parts.push(addr.city);
        if (addr.stateProvince) parts.push(addr.stateProvince);
        if (addr.postalCode) parts.push(addr.postalCode);
        if (addr.country) parts.push(addr.country);
        return parts.join(", ");
      }
      return String(response);
    }
    case "rating": {
      const max = (question.type as any)?.config?.max as number | undefined;
      return typeof max === "number"
        ? `${response} out of ${max}`
        : String(response);
    }
    case "linearScale": {
      const cfg = (question.type as any)?.config as
        | { start: number; end: number; startLabel?: string; endLabel?: string }
        | undefined;
      if (!cfg) return String(response);
      let res = String(response);
      if (response === cfg.start && cfg.startLabel)
        res += ` (${cfg.startLabel})`;
      else if (response === cfg.end && cfg.endLabel)
        res += ` (${cfg.endLabel})`;
      return res;
    }
    case "likertScale":
      return String(response);
    case "fileUpload": {
      const r: any = response as any;
      if (Array.isArray(r))
        return r.map((f) => f?.name ?? f?.filename ?? "File").join(", ");
      if (typeof r === "object" && r)
        return r?.name ?? r?.filename ?? "File uploaded";
      return "File uploaded";
    }
    case "date":
      return String(response);
    default:
      return String(response);
  }
}
