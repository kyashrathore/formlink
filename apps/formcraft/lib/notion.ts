import { Client } from "@notionhq/client"
import type {
  BlockObjectResponse,
  RichTextItemResponse,
} from "@notionhq/client/build/src/api-endpoints"

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

export type NotionBlock = BlockObjectResponse

export interface BlogPostPageData extends BlogPost {
  content: NotionBlock[]
}

type RichTextItem = RichTextItemResponse

function extractRichText(richTextArray: RichTextItem[]): string {
  return richTextArray?.map((text) => text.plain_text).join("") || ""
}

interface RelationItem {
  id: string
}

function extractRelation(relationArray: RelationItem[]): string[] {
  return relationArray?.map((item) => item.id) || []
}

interface DateProperty {
  start?: string
}

function extractDate(dateProperty: DateProperty | null): string {
  return dateProperty?.start || ""
}

function extractCheckbox(
  checkboxProperty: boolean | null | undefined
): boolean {
  return checkboxProperty || false
}

interface UrlProperty {
  url?: string
}

function extractUrl(urlProperty: UrlProperty | null): string | null {
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

    return response.results.map((page) => {
      const pageWithProperties = page as {
        id: string
        properties: Record<string, any>
      }
      const properties = pageWithProperties.properties
      return {
        id: pageWithProperties.id,
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
    throw new Error("Failed to fetch blog posts", { cause: error })
  }
}

export async function getBlogPostBySlug(
  slug: string
): Promise<BlogPostPageData | null> {
  try {
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

    const page = response.results[0] as {
      id: string
      properties: Record<string, any>
    }
    const properties = page.properties

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
    throw new Error("Failed to fetch blog post", { cause: error })
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

    const slugs = response.results.map((page) => {
      const pageWithProperties = page as { properties: Record<string, any> }
      const properties = pageWithProperties.properties
      return extractRichText(properties.Slug?.rich_text || [])
    })

    const uniqueSlugs = new Set(slugs)
    if (uniqueSlugs.size !== slugs.length) {
      const duplicates = slugs.filter(
        (slug, index) => slugs.indexOf(slug) !== index
      )
      throw new Error(`Duplicate slugs found: ${duplicates.join(", ")}`)
    }

    return slugs
  } catch (error) {
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
    console.error("Error updating OG image URL", error)
  }
}
