import type { SupabaseClient } from "@formlink/db"

function mergeObjects(target: any, source: any): any {
  if (source == null) return target
  const output = { ...target }
  Object.entries(source).forEach(([key, value]) => {
    if (
      value &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      typeof output[key] === "object" &&
      output[key] !== null &&
      !Array.isArray(output[key])
    ) {
      output[key] = mergeObjects(output[key], value)
    } else {
      output[key] = value
    }
  })
  return output
}

export async function applySidecarUpdates(
  supabase: SupabaseClient,
  submissionId: string,
  patch: Record<string, unknown>
): Promise<Record<string, unknown> | null> {
  if (!patch || Object.keys(patch).length === 0) return null

  const { data: submission, error } = await supabase
    .from("form_submissions")
    .select("metadata")
    .eq("submission_id", submissionId)
    .maybeSingle()

  if (error) {
    throw new Error(`Failed to load submission metadata: ${error.message}`)
  }

  const metadata = (submission?.metadata as Record<string, unknown>) || {}
  const currentSidecar = (metadata.sidecar as Record<string, unknown>) || {}
  const merged = mergeObjects(currentSidecar, patch)
  merged.last_intel_at = new Date().toISOString()

  const updatedMetadata = { ...metadata, sidecar: merged }

  const { error: updateError } = await supabase
    .from("form_submissions")
    .update({ metadata: updatedMetadata })
    .eq("submission_id", submissionId)

  if (updateError) {
    throw new Error(
      `Failed to update submission sidecar: ${updateError.message}`
    )
  }

  return merged
}
