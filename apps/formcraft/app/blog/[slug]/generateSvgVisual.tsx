import { generateText } from "@/app/lib/ai/tracing"
import { loadPrompt } from "@formlink/prompts"
import { openrouter } from "@openrouter/ai-sdk-provider"
import React from "react"

const evaluateComponent = (
  componentCode: string,
  React: typeof import("react")
) => {
  const cleanCode = componentCode
    .replace(/^```(jsx|tsx|javascript)\s*/, "")
    .replace(/```\s*$/, "")

  const func = new Function(
    "React",
    `
      ${cleanCode}
      return GeneratedVisual;
    `
  )
  return func(React)
}

export const generateSVGVisual = async ({
  title,
  description,
}: {
  title: string
  description: string
}) => {
  const systemPrompt = await loadPrompt("blog/minimalist-svg.md", {
    title,
    description,
  })
  const { text } = await generateText({
    model: openrouter("google/gemini-2.5-pro-preview-06-05"),
    system: systemPrompt,
    prompt: "Generate an SVG visual for the blog post.",
  })

  const componentCode = text.trim()
  const GeneratedVisual = evaluateComponent(componentCode, React)

  return GeneratedVisual
}
