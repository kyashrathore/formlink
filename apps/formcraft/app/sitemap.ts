import { MetadataRoute } from "next"
import { getPublishedBlogPosts } from "../lib/notion"

const URL = "https://formlink.ai"

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const posts = await getPublishedBlogPosts()

  const blogPosts = posts
    .filter((post) => !post.doNotIndex)
    .map((post) => {
      let lastModified: string

      // Use lastEditedTime if available, otherwise fall back to publish date
      const dateToUse = post.lastEditedTime || post.date

      try {
        lastModified = dateToUse
          ? new Date(dateToUse).toISOString()
          : new Date().toISOString()
      } catch (error) {
        // Fallback to current date if date is invalid
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
