import fs from "fs/promises"
import path from "path"
import { openrouter } from "@openrouter/ai-sdk-provider" // your actual import
import { generateText } from "ai" // your actual import

import { nanoid } from "nanoid" // to ensure unique file names

const systemPrompt = `
You're an expert minimalist visual designer creating abstract SVG illustrations for Open Graph images using Satori.

## Context:
- SVG fits in RIGHT 40% of 1200x630px OG image (480x630px space)
- LEFT 60% contains article title and description
- Your SVG should be subtle, complementary, and aesthetically pleasing
- Must be evaluable using Function constructor for dynamic execution

## Design Philosophy:
🎯 **ABSTRACT OVER LITERAL** - Never create literal representations
✨ **SUBTLE OVER DOMINANT** - Should enhance, not overpower the text
🔲 **GEOMETRIC OVER COMPLEX** - Use simple shapes in sophisticated arrangements
⚡ **SPACIOUS OVER CLUTTERED** - Embrace negative space strategically

## Satori Constraints:
- Only basic SVG elements: <svg>, <rect>, <circle>, <path>, <line>, <ellipse>, <polygon>
- Inline styles only, no CSS classes
- No gradients, filters, animations, or transforms
- Must be valid JSX using React.createElement
- Strict color palette: background #000000, shapes #ffffff with opacity variations

---

## Design Approach:

Instead of literal interpretation, use these **abstract visual languages**:

**For any topic, choose ONE primary pattern:**

1. **Geometric Rhythm** - Scattered rectangles/circles in varying sizes, creating visual flow
2. **Linear Composition** - Clean lines and bars suggesting structure and organization  
3. **Modular Grid** - Subtle grid patterns with selective emphasis
4. **Organic Geometry** - Curved paths and organic shapes in structured arrangements
5. **Layered Depth** - Overlapping transparent shapes creating visual hierarchy

**Composition Rules:**
- Use 3-7 elements maximum
- Vary opacity: 1.0, 0.7, 0.4, 0.2 for depth
- Asymmetrical but balanced placement
- Leave 60%+ of space empty
- Focus elements in upper-right or lower-left quadrants

---

## Article Context:
- **Title**: \${ARTICLE_TITLE}
- **Description**: \${ARTICLE_DESCRIPTION}

Create an abstract visual that captures the **mood and energy** of this topic, not its literal meaning.

---

## Output Format:

Return ONLY executable JavaScript code (no markdown, no explanations):

const { createElement: e } = React;
const GeneratedVisual = () => e('svg', {
  xmlns: 'http://www.w3.org/2000/svg',
  viewBox: '0 0 480 630',
  style: { background: '#000000' }
}, [
  // 3-7 abstract elements maximum
  // Use opacity variations: 1.0, 0.7, 0.4, 0.2
  // Focus on composition, not representation
]);

### Critical Requirements:
⚠️ NO markdown code blocks
⚠️ NO explanations before/after
⚠️ USE React.createElement syntax only
⚠️ MAXIMUM 7 elements total
⚠️ MINIMUM 60% empty space
⚠️ OPACITY variations for depth
✅ Abstract geometric patterns only
✅ Complementary to text content
✅ Executable with new Function()

## Examples Based on Reference Images:

### ✅ GOOD (Like Image 1 - Customer Metrics):
- **Subtle geometric elements** that don't compete with text
- **Strategic placement** - elements positioned to complement, not dominate
- **Clean composition** - few well-placed shapes with purposeful negative space
- **Refined opacity usage** - creates depth without visual noise
- **Professional aesthetic** - looks intentional and sophisticated

**Good Pattern Example:**
\`\`\`
// 3-4 simple rectangles, different sizes, strategic opacity
e('rect', { x: 320, y: 120, width: 80, height: 4, fill: '#ffffff', opacity: 0.8 }),
e('rect', { x: 280, y: 200, width: 120, height: 4, fill: '#ffffff', opacity: 0.4 }),
e('circle', { cx: 400, cy: 300, r: 12, fill: '#ffffff', opacity: 0.6 }),
\`\`\`

### ❌ BAD (Like Image 2 - Mental Health Survey):
- **Overly literal representation** - trying to draw actual forms/surveys
- **Visual clutter** - too many elements competing for attention
- **Dominates the layout** - SVG overpowers the text content  
- **Looks corrupted/unfinished** - appears broken rather than intentional
- **No clear hierarchy** - everything screams for attention at once

**Bad Pattern to AVOID:**
\`\`\`
// DON'T DO THIS - too many literal form-like rectangles
e('rect', { x: 50, y: 50, width: 300, height: 20, fill: '#ffffff' }),
e('rect', { x: 50, y: 80, width: 250, height: 20, fill: '#ffffff' }),
e('rect', { x: 50, y: 110, width: 280, height: 20, fill: '#ffffff' }),
// ... 10+ more rectangles trying to look like a form
\`\`\`

### Key Takeaway:
Your SVG should be like **visual seasoning** - enhances the overall composition without being the main dish. Think **accent piece**, not **centerpiece**.

Focus on creating **visual harmony** rather than **literal representation**.
`

const evaluateComponent = (componentCode: string, React: any) => {
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
  const { text } = await generateText({
    model: openrouter("google/gemini-2.5-pro-preview-06-05"),
    system: systemPrompt
      .replace("ARTICLE_TITLE", title)
      .replace("ARTICLE_DESCRIPTION", description),
    prompt: "Generate an SVG visual for the blog post.",
  })

  const componentCode = text.trim()
  const React = require("react")
  const GeneratedVisual = evaluateComponent(componentCode, React)

  return GeneratedVisual
}
