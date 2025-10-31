import type {
  RuntimeSubmissionResult,
  RuntimeTransport,
  RuntimeUploadDescriptor,
  RuntimeValues,
} from "../types";

export type MockTransportOptions = {
  /** Artificial delay for submit (ms). Default: 300 */
  delayMs?: number;
  /** Artificial delay for partial save (ms). Default: 150 */
  saveDelayMs?: number;
  /** Artificial delay for upload (ms). Default: 250 */
  uploadDelayMs?: number;
  /** Custom submit handler to override default echo behavior. */
  onSubmit?: (values: RuntimeValues) => Promise<unknown> | unknown;
  /** Custom savePartial handler. */
  onSavePartial?: (values: RuntimeValues) => Promise<void> | void;
  /** Custom upload handler. */
  onUpload?: (
    questionId: string,
    file: File | Blob,
  ) => Promise<RuntimeUploadDescriptor> | RuntimeUploadDescriptor;
  /** Generate object URL for File uploads. Default: true */
  generateObjectUrl?: boolean;
  /** If generating object URLs, revoke after this many ms. Default: undefined (do not revoke automatically) */
  revokeAfterMs?: number;
};

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function createMockTransport(
  options: MockTransportOptions = {},
): RuntimeTransport {
  const {
    delayMs = 300,
    saveDelayMs = 150,
    uploadDelayMs = 250,
    onSubmit,
    onSavePartial,
    onUpload,
    generateObjectUrl = true,
    revokeAfterMs,
  } = options;

  return {
    async submit(values: RuntimeValues): Promise<RuntimeSubmissionResult> {
      await wait(delayMs);
      const response =
        typeof onSubmit === "function"
          ? await onSubmit(values)
          : { ok: true, values };
      return { response };
    },
    async savePartial(values: RuntimeValues): Promise<void> {
      await wait(saveDelayMs);
      if (typeof onSavePartial === "function") {
        await onSavePartial(values);
      }
    },
    async upload(
      questionId: string,
      file: File | Blob,
    ): Promise<RuntimeUploadDescriptor> {
      await wait(uploadDelayMs);
      if (typeof onUpload === "function") {
        return await onUpload(questionId, file);
      }
      let url = "";
      let name = questionId;
      let size = 0;
      let mimeType: string | undefined;
      if (file instanceof File) {
        name = file.name || name;
      }
      if (
        generateObjectUrl &&
        typeof URL !== "undefined" &&
        URL.createObjectURL &&
        file instanceof Blob
      ) {
        url = URL.createObjectURL(file);
        if (typeof revokeAfterMs === "number" && revokeAfterMs >= 0) {
          setTimeout(() => {
            try {
              URL.revokeObjectURL(url);
            } catch {
              // ignore revoke failures
            }
          }, revokeAfterMs);
        }
      }
      if (!url) {
        // Fallback data URL-ish marker when object URL isn't generated
        url = `mock://${questionId}/${Date.now()}`;
      }
      if (file instanceof Blob) {
        size = file.size;
        mimeType = file.type || undefined;
      }
      return { url, name, size, mimeType };
    },
  };
}
