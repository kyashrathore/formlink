import fs from "node:fs/promises"
import path from "node:path"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"

export default async function TermsPage() {
  const markdownPath = path.join(process.cwd(), "app", "terms", "terms.md")
  let content = ""

  try {
    content = await fs.readFile(markdownPath, "utf-8")
  } catch (error) {
    console.error("Failed to read terms.md:", error)
    // Return a user-friendly error message or a fallback UI
    return (
      <div className="container mx-auto p-4">
        <h1 className="mb-4 text-2xl font-bold">Terms of Use</h1>
        <p>
          Could not load the terms of use at this time. Please try again later.
        </p>
      </div>
    )
  }

  return (
    <div className="container mx-auto max-w-3xl p-6">
      <article className="prose dark:prose-invert max-w-3xl">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
      </article>
    </div>
  )
}

// Enable Static Site Generation for this page
export async function generateStaticParams() {
  // This page doesn't have dynamic segments, so we return an empty array
  // or an array with an empty object if required by the Next.js version
  // for it to be considered for SSG.
  return [{}]
}
