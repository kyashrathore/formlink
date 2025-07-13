interface FormVersionData {
  version_id: string
  title: any
  description: any
  questions: any
  status: "draft" | "published" | "archived"
  updated_at: string
  published_at: string | null
  archived_at: string | null
}

export interface FormWithVersions {
  id: string
  current_published_version_id: string | null
  current_draft_version_id: string | null
  published_version: FormVersionData | null
  draft_version: FormVersionData | null
}
