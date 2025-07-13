import { Client } from "@notionhq/client"

const notion = new Client({
  auth: process.env.NOTION_API_KEY,
})

const databaseId = process.env.NOTION_BLOG_DATABASE_ID!

export interface BlogPost {
  id: string
  title: string
  slug: string
  date: string
  lastEditedTime?: string
  tags: string[]
  authors: string[]
  summary: string
  published: boolean
  metaTitle: string
  metaDescription: string
  doNotIndex: boolean
  ogImageUrl?: string | null
}

export interface NotionBlock {
  id: string
  type: string
  [key: string]: any
}

export interface BlogPostPageData extends BlogPost {
  content: NotionBlock[]
}

function extractRichText(richTextArray: any[]): string {
  return richTextArray?.map((text) => text.plain_text).join("") || ""
}

function extractMultiSelect(multiSelectArray: any[]): string[] {
  return multiSelectArray?.map((item) => item.name) || []
}

function extractRelation(relationArray: any[]): string[] {
  return relationArray?.map((item) => item.id) || []
}

function extractDate(dateProperty: any): string {
  return dateProperty?.start || ""
}

function extractCheckbox(checkboxProperty: any): boolean {
  return checkboxProperty || false
}

function extractUrl(urlProperty: any): string | null {
  return urlProperty?.url || null
}

export async function getPublishedBlogPosts(): Promise<BlogPost[]> {
  try {
    const response = await notion.databases.query({
      database_id: databaseId,
      filter: {
        property: "Ready to Publish",
        checkbox: {
          equals: true,
        },
      },
      sorts: [
        {
          property: "Publish Date",
          direction: "descending",
        },
      ],
    })

    return response.results.map((page: any) => {
      const properties = page.properties
      return {
        id: page.id,
        title: extractRichText(properties.Name?.title || []),
        slug: extractRichText(properties.Slug?.rich_text || []),
        date: extractDate(properties["Publish Date"]?.date),
        lastEditedTime: properties["Last Edited Time"]?.last_edited_time,
        tags: extractRelation(properties.Tags?.relation || []),
        authors: extractRelation(properties.Authors?.relation || []),
        summary: extractRichText(properties.Excerpt?.rich_text || []),
        published: extractCheckbox(properties["Ready to Publish"]?.checkbox),
        metaTitle: extractRichText(properties["Meta Title"]?.rich_text || []),
        metaDescription: extractRichText(
          properties["Meta Description"]?.rich_text || []
        ),
        doNotIndex: extractCheckbox(properties["Do not index"]?.checkbox),
        ogImageUrl: extractUrl(properties["Og Image Url"]),
      }
    })
  } catch (error) {
    console.error("Error fetching blog posts:", error)
    throw new Error("Failed to fetch blog posts")
  }
}

export async function getBlogPostBySlug(
  slug: string
): Promise<BlogPostPageData | null> {
  try {
    // First, find the page by slug
    const response = await notion.databases.query({
      database_id: databaseId,
      filter: {
        and: [
          {
            property: "Ready to Publish",
            checkbox: {
              equals: true,
            },
          },
          {
            property: "Slug",
            rich_text: {
              equals: slug,
            },
          },
        ],
      },
    })
    if (response.results.length === 0) {
      return null
    }

    const page = response.results[0] as any
    const properties = page.properties

    // Get the page content blocks
    const blocksResponse = await notion.blocks.children.list({
      block_id: page.id,
    })

    const blogPost: BlogPost = {
      id: page.id,
      title: extractRichText(properties.Name?.title || []),
      slug: extractRichText(properties.Slug?.rich_text || []),
      date: extractDate(properties["Publish Date"]?.date),
      lastEditedTime: properties["Last Edited Time"]?.last_edited_time,
      tags: extractRelation(properties.Tags?.relation || []),
      authors: extractRelation(properties.Authors?.relation || []),
      summary: extractRichText(properties.Excerpt?.rich_text || []),
      published: extractCheckbox(properties["Ready to Publish"]?.checkbox),
      metaTitle: extractRichText(properties["Meta Title"]?.rich_text || []),
      metaDescription: extractRichText(
        properties["Meta Description"]?.rich_text || []
      ),
      doNotIndex: extractCheckbox(properties["Do not index"]?.checkbox),
      ogImageUrl: extractUrl(properties["Og Image Url"]),
    }

    return {
      ...blogPost,
      content: blocksResponse.results as NotionBlock[],
    }
  } catch (error) {
    console.error("Error fetching blog post by slug:", error)
    throw new Error("Failed to fetch blog post")
  }
}

export async function getAllPostSlugs(): Promise<string[]> {
  try {
    const response = await notion.databases.query({
      database_id: databaseId,
      filter: {
        property: "Ready to Publish",
        checkbox: {
          equals: true,
        },
      },
    })

    const slugs = response.results.map((page: any) => {
      const properties = page.properties
      return extractRichText(properties.Slug?.rich_text || [])
    })

    // Check for duplicate slugs
    const uniqueSlugs = new Set(slugs)
    if (uniqueSlugs.size !== slugs.length) {
      const duplicates = slugs.filter(
        (slug, index) => slugs.indexOf(slug) !== index
      )
      throw new Error(`Duplicate slugs found: ${duplicates.join(", ")}`)
    }

    return slugs
  } catch (error) {
    console.error("Error fetching post slugs:", error)
    throw error
  }
}

export async function updateOgImageUrl(
  pageId: string,
  imageUrl: string
): Promise<void> {
  try {
    await notion.pages.update({
      page_id: pageId,
      properties: {
        "Og Image Url": {
          url: imageUrl,
        },
      },
    })
  } catch (error) {
    console.error(`Failed to update OG image URL for page ${pageId}:`, error)
    // We don't re-throw here to avoid breaking the image generation flow
    // The error is logged, and we can handle it offline if needed.
  }
}
