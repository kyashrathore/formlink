import fs from "node:fs/promises"
import path from "node:path"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"

export default async function CookiesPage() {
  const markdownPath = path.join(process.cwd(), "app", "cookies", "cookies.md")
  let content = ""

  try {
    content = await fs.readFile(markdownPath, "utf-8")
  } catch (error) {
    console.error("Failed to read cookies.md:", error)
    // Return a user-friendly error message or a fallback UI
    return (
      <div className="container mx-auto p-4">
        <h1 className="mb-4 text-2xl font-bold">Cookie Policy</h1>
        <p>
          Could not load the cookie policy at this time. Please try again later.
        </p>
      </div>
    )
  }

  return (
    <div className="container mx-auto max-w-2xl p-6">
      <article className="prose dark:prose-invert">
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
