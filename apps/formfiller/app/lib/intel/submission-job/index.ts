export type SubmissionLifecycleTrigger = "completed" | "partial" | "manual";

export type RunSubmissionJobOptions = {
  submissionId: string;
  formVersionId?: string | null;
  trigger: SubmissionLifecycleTrigger;
};

const DEFAULT_ENDPOINT = process.env.FORMCRAFT_LIFECYCLE_ENDPOINT || "";
const INTERNAL_TOKEN = process.env.FORMCRAFT_LIFECYCLE_TOKEN || "";

export async function runSubmissionJob(
  options: RunSubmissionJobOptions,
): Promise<void> {
  if (!DEFAULT_ENDPOINT) {
    return;
  }

  try {
    await fetch(DEFAULT_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(INTERNAL_TOKEN ? { "x-internal-token": INTERNAL_TOKEN } : {}),
      },
      body: JSON.stringify(options),
    });
  } catch (error) {
    // previously logged lifecycle job trigger failures; logs removed.
  }
}
