import { MetadataRoute } from "next"
import { getPublishedBlogPosts } from "../lib/notion"

const URL = "https://formlink.ai"

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  let posts: Awaited<ReturnType<typeof getPublishedBlogPosts>> = []
  try {
    posts = await getPublishedBlogPosts()
  } catch (err) {
    console.warn(
      "[sitemap] failed to fetch blog posts; continuing with static routes",
      {
        error: err instanceof Error ? err.message : String(err),
      }
    )
    posts = []
  }

  const blogPosts = posts
    .filter((post) => !post.doNotIndex)
    .map((post) => {
      let lastModified: string

      const dateToUse = post.lastEditedTime || post.date

      try {
        lastModified = dateToUse
          ? new Date(dateToUse).toISOString()
          : new Date().toISOString()
      } catch (error) {
        console.error(`Invalid date for post ${post.slug}: ${dateToUse}`, error)
        lastModified = new Date().toISOString()
      }

      return {
        url: `${URL}/blog/${post.slug}`,
        lastModified,
      }
    })

  const staticRoutes = ["/", "/blog", "/privacy", "/terms"].map((route) => ({
    url: `${URL}${route}`,
    lastModified: new Date().toISOString(),
  }))

  return [...staticRoutes, ...blogPosts]
}
