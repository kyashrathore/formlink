import Link from "next/link"
import { notFound } from "next/navigation"
import { getAllPostSlugs, getBlogPostBySlug } from "../../../lib/notion"
import NotionBlockRenderer from "../components/NotionBlockRenderer"

export const revalidate = 60 // Revalidate every minute

export async function generateStaticParams() {
  try {
    const slugs = await getAllPostSlugs()
    return slugs.map((slug) => ({
      slug,
    }))
  } catch (error) {
    console.error("Error generating static params:", error)
    return []
  }
}

interface BlogPostPageProps {
  params: Promise<{ slug: string }>
}

function JsonLd({ post }: { post: any }) {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"
  const postUrl = `${siteUrl}/blog/${post.slug}`
  const imageUrl = `${postUrl}/opengraph-image`
  const isoDate = new Date(post.date).toISOString()

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": postUrl,
    },
    headline: post.title,
    description: post.summary,
    image: imageUrl,
    datePublished: isoDate,
    author: post.authors.map((author: string) => ({
      "@type": "Person",
      name: author,
    })),
    publisher: {
      "@type": "Organization",
      name: "Formcraft",
      logo: {
        "@type": "ImageObject",
        url: `${siteUrl}/formlink-logo.png`,
      },
    },
  }

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  )
}

export default async function BlogPostPage({ params }: BlogPostPageProps) {
  const { slug } = await params

  try {
    const post = await getBlogPostBySlug(slug)

    if (!post) {
      notFound()
    }
    // Group consecutive list items
    const groupedContent = groupListItems(post.content)

    return (
      <>
        <JsonLd post={post} />
        <div className="container mx-auto max-w-4xl px-4 py-8">
          {/* Back to blog link */}
          <div className="mb-8">
            <Link
              href="/blog"
              className="text-primary hover:text-primary/80 inline-flex items-center font-medium transition-colors"
            >
              <svg
                className="mr-2 h-4 w-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 19l-7-7 7-7"
                />
              </svg>
              Back to Blog
            </Link>
          </div>

          {/* Article header */}
          <header className="mb-12">
            <h1 className="text-foreground mb-6 text-4xl font-bold">
              {post.title}
            </h1>

            <div className="text-muted-foreground mb-6 flex flex-wrap items-center gap-4 text-sm">
              {post.date && (
                <time dateTime={post.date}>
                  {new Date(post.date).toLocaleDateString("en-US", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </time>
              )}

              {post.authors.length > 0 && (
                <div className="flex items-center gap-1">
                  <span>by</span>
                  <span>{post.authors.join(", ")}</span>
                </div>
              )}
            </div>

            {post.tags.length > 0 && (
              <div className="mb-8 flex flex-wrap gap-2">
                {post.tags.map((tag) => (
                  <span
                    key={tag}
                    className="bg-secondary text-secondary-foreground rounded-full px-3 py-1 text-sm"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}

            {post.summary && (
              <div className="text-foreground bg-muted border-primary mb-8 rounded-lg border-l-4 p-4 text-lg leading-relaxed">
                {post.summary}
              </div>
            )}
          </header>

          {/* Article content */}
          <article className="prose prose-lg max-w-none">
            <div className="space-y-0">
              {groupedContent.map((item, index) => {
                if (item.type === "list" && item.items) {
                  const ListTag = item.listType === "bulleted" ? "ul" : "ol"
                  return (
                    <ListTag key={index} className="mb-4 list-inside list-disc">
                      {item.items.map((block, itemIndex) => (
                        <NotionBlockRenderer
                          key={block.id || itemIndex}
                          block={block}
                        />
                      ))}
                    </ListTag>
                  )
                } else if (item.block) {
                  return (
                    <NotionBlockRenderer
                      key={item.block.id || index}
                      block={item.block}
                    />
                  )
                }
                return null
              })}
            </div>
          </article>

          {/* Footer */}
          <footer className="border-border mt-16 border-t pt-8">
            <div className="text-center">
              <Link
                href="/blog"
                className="text-primary hover:text-primary/80 inline-flex items-center font-medium transition-colors"
              >
                <svg
                  className="mr-2 h-4 w-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 19l-7-7 7-7"
                  />
                </svg>
                Back to all posts
              </Link>
            </div>
          </footer>
        </div>
      </>
    )
  } catch (error) {
    console.error("Error loading blog post:", error)
    notFound()
  }
}

// Helper function to group consecutive list items
function groupListItems(blocks: any[]) {
  const grouped: Array<{
    type: "block" | "list"
    block?: any
    listType?: "bulleted" | "numbered"
    items?: any[]
  }> = []

  let currentList: any[] = []
  let currentListType: "bulleted" | "numbered" | null = null

  for (const block of blocks) {
    if (
      block.type === "bulleted_list_item" ||
      block.type === "numbered_list_item"
    ) {
      const listType =
        block.type === "bulleted_list_item" ? "bulleted" : "numbered"

      if (currentListType === listType) {
        // Continue the current list
        currentList.push(block)
      } else {
        // Finish the previous list if it exists
        if (currentList.length > 0) {
          grouped.push({
            type: "list",
            listType: currentListType!,
            items: currentList,
          })
        }

        // Start a new list
        currentList = [block]
        currentListType = listType
      }
    } else {
      // Finish the current list if it exists
      if (currentList.length > 0) {
        grouped.push({
          type: "list",
          listType: currentListType!,
          items: currentList,
        })
        currentList = []
        currentListType = null
      }

      // Add the non-list block
      grouped.push({
        type: "block",
        block,
      })
    }
  }

  // Don't forget the last list if it exists
  if (currentList.length > 0) {
    grouped.push({
      type: "list",
      listType: currentListType!,
      items: currentList,
    })
  }

  return grouped
}

export async function generateMetadata({ params }: BlogPostPageProps) {
  try {
    const { slug } = await params
    const post = await getBlogPostBySlug(slug)

    if (!post) {
      return {
        title: "Post Not Found",
      }
    }

    const title = post.metaTitle || post.title
    const description =
      post.metaDescription || post.summary || `Read ${post.title} on our blog`
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"
    const postUrl = `${siteUrl}/blog/${post.slug}`

    const metadata: any = {
      title,
      description,
      keywords: post.tags,
      authors: post.authors.map((author) => ({ name: author })),
      alternates: {
        canonical: postUrl,
      },
      openGraph: {
        title,
        description,
        url: postUrl,
        type: "article",
        publishedTime: post.date,
        authors: post.authors,
        tags: post.tags,
      },
      twitter: {
        card: "summary_large_image",
        title,
        description,
      },
    }

    if (post.doNotIndex) {
      metadata.robots = {
        index: false,
        follow: false,
      }
    }

    return metadata
  } catch (error) {
    console.error("Error generating metadata:", error)
    return {
      title: "Blog Post",
    }
  }
}
