import Image from "next/image"
import Link from "next/link"
import { BlogPost, getPublishedBlogPosts } from "../../lib/notion"

export const revalidate = 3600 // Revalidate every hour

export default async function BlogPage() {
  let posts: BlogPost[] = []
  let error: string | null = null

  try {
    posts = await getPublishedBlogPosts()
  } catch (err) {
    console.error("Failed to load blog posts:", err)
    error = err instanceof Error ? err.message : "Unknown error occurred"
    posts = []
  }

  return (
    <div className="container mx-auto max-w-6xl px-4 py-12">
      <header className="mb-16 text-center">
        <h1 className="text-foreground text-5xl font-bold tracking-tight">
          Building Better Forms With AI
        </h1>
        <p className="text-muted-foreground mx-auto mt-4 max-w-2xl text-lg">
          Explore our latest articles, tutorials, and insights on creating
          intelligent forms.
        </p>
      </header>

      {error && (
        <div className="py-12 text-center text-red-500">
          <p>Error loading posts: {error}</p>
        </div>
      )}

      <main className="grid grid-cols-1 gap-12 md:grid-cols-2">
        {posts.length === 0 && !error ? (
          <div className="py-12 text-center md:col-span-2">
            <p className="text-muted-foreground text-lg">
              No blog posts published yet.
            </p>
          </div>
        ) : (
          posts.map((post) => (
            <Link
              key={post.id}
              href={`/blog/${post.slug}`}
              className="group block"
            >
              <article className="flex h-full flex-col">
                <div className="relative mb-6 aspect-video w-full overflow-hidden rounded-lg shadow-md">
                  {post.ogImageUrl ? (
                    <Image
                      src={post.ogImageUrl}
                      alt={post.title}
                      fill
                      className="object-cover transition-transform duration-300 group-hover:scale-105"
                      sizes="(max-width: 768px) 100vw, 50vw"
                      unoptimized
                    />
                  ) : (
                    <div className="bg-secondary flex h-full w-full items-center justify-center">
                      <span className="text-muted-foreground">No Image</span>
                    </div>
                  )}
                </div>

                <div className="flex flex-grow flex-col">
                  {post.date && (
                    <time
                      dateTime={post.date}
                      className="text-muted-foreground mb-2 text-sm"
                    >
                      {new Date(post.date).toLocaleDateString("en-US", {
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      })}
                    </time>
                  )}
                  <h2 className="text-foreground group-hover:text-primary text-2xl leading-tight font-bold transition-colors">
                    {post.title}
                  </h2>
                </div>
              </article>
            </Link>
          ))
        )}
      </main>
    </div>
  )
}
