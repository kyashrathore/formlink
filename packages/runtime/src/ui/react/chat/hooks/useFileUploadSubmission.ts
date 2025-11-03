"use client";

export function useFileUploadSubmission(opts: {
  uploadApi: string;
  submitSelection: (
    questionId: string,
    value: any,
    displayText: string,
  ) => Promise<void> | void;
}) {
  const { uploadApi, submitSelection } = opts;

  async function handleFileUpload(
    questionId: string,
    file: File | File[],
  ): Promise<void> {
    const f = Array.isArray(file) ? (file[0] as File) : file;
    if (!f) return;
    const formData = new FormData();
    formData.append("file", f);
    // The server may also accept submissionId/formId; caller can modify uploadApi accordingly.
    const res = await fetch(uploadApi, { method: "POST", body: formData });
    if (!res.ok) {
      throw new Error(`Upload failed: ${res.status}`);
    }
    const json = await res.json();
    const details = {
      url: json?.url,
      name: json?.fileName ?? f.name,
      size: json?.fileSize ?? f.size,
    };
    await submitSelection(
      questionId,
      details,
      `Uploaded file: ${details.name}`,
    );
  }

  return { handleFileUpload } as const;
}
