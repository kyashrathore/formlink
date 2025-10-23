import type {
  RuntimeSubmissionResult,
  RuntimeTransport,
  RuntimeUploadDescriptor,
  RuntimeValues,
} from "../types";

export class RuntimeTransportError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
  ) {
    super(message);
    this.name = "RuntimeTransportError";
  }
}

export interface FetchTransportOptions {
  baseUrl: string;
  /**
   * Relative path appended to the baseUrl for form submission.
   * Defaults to `/forms/submit`.
   */
  submitPath?: string;
  /**
   * Relative path appended to the baseUrl for partial saves.
   * Defaults to `/forms/save`.
   */
  partialPath?: string;
  /**
   * Relative path appended to the baseUrl for file uploads.
   * Defaults to `/files/upload`.
   */
  uploadPath?: string;
  headers?: Record<string, string>;
}

async function parseJson(response: Response) {
  const text = await response.text();
  if (!text) return undefined;
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

async function ensureOk(response: Response) {
  if (response.ok) return;
  const payload = await parseJson(response);
  const message =
    typeof payload?.message === "string"
      ? payload.message
      : `Request failed with status ${response.status}.`;
  throw new RuntimeTransportError(message, response.status);
}

function normalizeBaseUrl(baseUrl: string) {
  return baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;
}

export function fetchTransport(
  options: FetchTransportOptions,
): RuntimeTransport {
  const {
    baseUrl,
    submitPath = "/forms/submit",
    partialPath = "/forms/save",
    uploadPath = "/files/upload",
    headers = {},
  } = options;

  const normalizedBase = normalizeBaseUrl(baseUrl);

  const jsonHeaders: Record<string, string> = {
    "Content-Type": "application/json",
    ...headers,
  };

  return {
    async submit(values: RuntimeValues): Promise<RuntimeSubmissionResult> {
      const response = await fetch(`${normalizedBase}${submitPath}`, {
        method: "POST",
        headers: jsonHeaders,
        body: JSON.stringify({ values }),
      });
      await ensureOk(response);
      const payload = await parseJson(response);
      return { response: payload };
    },
    async savePartial(values: RuntimeValues): Promise<void> {
      const response = await fetch(`${normalizedBase}${partialPath}`, {
        method: "POST",
        headers: jsonHeaders,
        body: JSON.stringify({ values }),
      });
      await ensureOk(response);
    },
    async upload(
      questionId: string,
      file: File | Blob,
    ): Promise<RuntimeUploadDescriptor> {
      const formData = new FormData();
      formData.append("questionId", questionId);
      if (file instanceof File) {
        formData.append("file", file);
      } else {
        formData.append("file", file, questionId);
      }
      const response = await fetch(`${normalizedBase}${uploadPath}`, {
        method: "POST",
        headers,
        body: formData,
      });
      await ensureOk(response);
      const payload = await parseJson(response);
      if (
        !payload ||
        typeof payload.url !== "string" ||
        typeof payload.name !== "string" ||
        typeof payload.size !== "number"
      ) {
        throw new RuntimeTransportError(
          "Upload response missing required fields (url, name, size).",
          response.status,
        );
      }
      return {
        url: payload.url,
        name: payload.name,
        size: payload.size,
        mimeType:
          typeof payload.mimeType === "string" ? payload.mimeType : undefined,
        metadata:
          typeof payload.metadata === "object"
            ? (payload.metadata ?? undefined)
            : undefined,
      };
    },
  };
}
