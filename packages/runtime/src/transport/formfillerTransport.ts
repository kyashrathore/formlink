import type {
  RuntimeSubmissionResult,
  RuntimeTransport,
  RuntimeUploadDescriptor,
  RuntimeValues,
} from "../types";

export type FormfillerTransportOptions = {
  baseUrl?: string; // default ""
  formId: string;
  submissionId: string;
  formVersionId: string;
  isTestSubmission?: boolean;
  headers?: Record<string, string>;
};

function normalizeBaseUrl(baseUrl: string | undefined) {
  if (!baseUrl) return "";
  return baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;
}

export function createFormfillerTransport(
  opts: FormfillerTransportOptions,
): RuntimeTransport {
  const {
    baseUrl,
    formId,
    submissionId,
    formVersionId,
    isTestSubmission = false,
    headers = {},
  } = opts;

  const base = normalizeBaseUrl(baseUrl);
  const saveUrl = `${base}/api/forms/${formId}/save-answers`;
  const uploadUrl = `${base}/api/upload`;

  return {
    async submit(values: RuntimeValues): Promise<RuntimeSubmissionResult> {
      const body = {
        submissionId,
        formVersionId,
        submissionStatus: "completed" as const,
        testmode: isTestSubmission,
        allResponses: values,
      };
      const res = await fetch(saveUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...headers },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(`Submit failed: ${res.status}`);
      const payload = await res.json().catch(() => undefined);
      return { response: payload };
    },
    async savePartial(values: RuntimeValues): Promise<void> {
      const body = {
        submissionId,
        formVersionId,
        isPartial: true,
        submissionStatus: "in_progress" as const,
        testmode: isTestSubmission,
        allResponses: values,
      };
      const res = await fetch(saveUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...headers },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(`Partial save failed: ${res.status}`);
    },
    async upload(
      questionId: string,
      file: File | Blob,
    ): Promise<RuntimeUploadDescriptor> {
      const fd = new FormData();
      fd.append("questionId", questionId);
      fd.append("formId", formId);
      fd.append("submissionId", submissionId);
      if (file instanceof File) fd.append("file", file);
      else fd.append("file", file, questionId);
      const res = await fetch(uploadUrl, { method: "POST", headers, body: fd });
      if (!res.ok) throw new Error(`Upload failed: ${res.status}`);
      const payload = await res.json();
      return payload as RuntimeUploadDescriptor;
    },
  };
}
