import { NotionBlock } from "../../../lib/notion"

interface NotionBlockRendererProps {
  block: NotionBlock
}

export default function NotionBlockRenderer({
  block,
}: NotionBlockRendererProps) {
  const { type } = block

  switch (type) {
    case "paragraph":
      return (
        <p className="text-foreground mb-4 leading-relaxed">
          {renderRichText(block.paragraph?.rich_text || [])}
        </p>
      )

    case "heading_1":
      return (
        <h1 className="text-foreground mt-8 mb-6 text-3xl font-bold">
          {renderRichText(block.heading_1?.rich_text || [])}
        </h1>
      )

    case "heading_2":
      return (
        <h2 className="text-foreground mt-6 mb-4 text-2xl font-bold">
          {renderRichText(block.heading_2?.rich_text || [])}
        </h2>
      )

    case "heading_3":
      return (
        <h3 className="text-foreground mt-5 mb-3 text-xl font-bold">
          {renderRichText(block.heading_3?.rich_text || [])}
        </h3>
      )

    case "bulleted_list_item":
      return (
        <li className="text-foreground mb-2 ml-4">
          {renderRichText(block.bulleted_list_item?.rich_text || [])}
        </li>
      )

    case "numbered_list_item":
      return (
        <li className="text-foreground mb-2 ml-4">
          {renderRichText(block.numbered_list_item?.rich_text || [])}
        </li>
      )

    case "code":
      return (
        <pre className="bg-muted mb-4 overflow-x-auto rounded-lg p-4">
          <code className="text-sm">
            {renderRichText(block.code?.rich_text || [])}
          </code>
        </pre>
      )

    case "quote":
      return (
        <blockquote className="border-border text-muted-foreground mb-4 border-l-4 pl-4 italic">
          {renderRichText(block.quote?.rich_text || [])}
        </blockquote>
      )

    case "callout":
      return (
        <div className="bg-muted border-border mb-4 rounded-lg border p-4">
          <div className="flex items-start gap-3">
            {block.callout?.icon && (
              <span className="text-lg">
                {typeof block.callout.icon === "string"
                  ? block.callout.icon
                  : block.callout.icon?.emoji || "💡"}
              </span>
            )}
            <div className="text-foreground flex-1">
              {renderRichText(block.callout?.rich_text || [])}
            </div>
          </div>
        </div>
      )

    case "divider":
      return <hr className="border-border my-8" />

    case "image":
      const imageUrl = block.image?.file?.url || block.image?.external?.url
      const captionText = block.image?.caption
        ? block.image.caption.map((text: any) => text.plain_text).join("")
        : ""
      const captionElement = block.image?.caption
        ? renderRichText(block.image.caption)
        : ""

      if (!imageUrl) return null

      return (
        <figure className="mb-6">
          <img
            src={imageUrl}
            alt={captionText || "Blog image"}
            className="w-full rounded-lg shadow-sm"
          />
          {captionElement && (
            <figcaption className="text-muted-foreground mt-2 text-center text-sm italic">
              {captionElement}
            </figcaption>
          )}
        </figure>
      )

    case "embed":
      const embedUrl = block.embed?.url
      if (!embedUrl) return null

      return (
        <div className="mb-6">
          <iframe
            src={embedUrl}
            className="h-96 w-full rounded-lg border"
            allowFullScreen
          />
        </div>
      )

    default:
      // For unsupported block types, try to render any rich_text content
      const richText = block[type]?.rich_text
      if (richText && Array.isArray(richText)) {
        return <div className="mb-4">{renderRichText(richText)}</div>
      }

      return null
  }
}

function renderRichText(richTextArray: any[]): React.ReactNode {
  if (!richTextArray || !Array.isArray(richTextArray)) {
    return null
  }

  return richTextArray.map((text, index) => {
    const { plain_text, annotations, href } = text

    let element: React.ReactNode = plain_text

    // Apply text formatting
    if (annotations?.bold) {
      element = (
        <strong key={index} className="text-foreground font-bold">
          {element}
        </strong>
      )
    }
    if (annotations?.italic) {
      element = <em key={index}>{element}</em>
    }
    if (annotations?.strikethrough) {
      element = <del key={index}>{element}</del>
    }
    if (annotations?.underline) {
      element = <u key={index}>{element}</u>
    }
    if (annotations?.code) {
      element = (
        <code key={index} className="bg-muted rounded px-1 py-0.5 text-sm">
          {element}
        </code>
      )
    }

    // Apply link
    if (href) {
      element = (
        <a
          key={index}
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary hover:text-primary/80 underline"
        >
          {element}
        </a>
      )
    }

    return <span key={index}>{element}</span>
  })
}
