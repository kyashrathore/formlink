import fs from "node:fs/promises"
import path from "node:path"
import { NextRequest, NextResponse } from "next/server"
import * as ts from "typescript"

export const runtime = "nodejs"

const TARGET_ROOT = path.resolve(process.cwd(), "../../apps/preview")

function findTargetNode(
  sourceFile: ts.SourceFile,
  targetLine: number,
  originalText: string,
  tolerance: number = 0
): ts.Node | null {
  // Candidates array to store potential matches
  const candidates: { node: ts.Node; distance: number; type: string }[] = []

  // Normalize target text for comparison (ignore whitespace differences)
  const normalizedTarget = originalText.trim().replace(/\s+/g, " ")
  const LINE_TOLERANCE = tolerance

  function visit(node: ts.Node) {
    // Get line numbers (1-based)
    const start =
      sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line +
      1
    const end = sourceFile.getLineAndCharacterOfPosition(node.getEnd()).line + 1

    // Check if node overlaps with target line window
    if (
      end >= targetLine - LINE_TOLERANCE &&
      start <= targetLine + LINE_TOLERANCE
    ) {
      // Check if it's a Text-like node
      if (
        ts.isJsxText(node) ||
        ts.isStringLiteral(node) ||
        ts.isNoSubstitutionTemplateLiteral(node)
      ) {
        const content = ts.isJsxText(node) ? node.text : node.text // .text gives value without quotes
        const normalizedContent = content.trim().replace(/\s+/g, " ")

        if (normalizedContent.includes(normalizedTarget)) {
          // Calculate distance to target line
          // Use the closer of start or end, or 0 if inside
          let distance = 0
          if (targetLine < start) distance = start - targetLine
          else if (targetLine > end) distance = targetLine - end

          candidates.push({ node, distance, type: "exact" })
        }
      }

      ts.forEachChild(node, visit)
    }
  }

  ts.forEachChild(sourceFile, visit)

  if (candidates.length === 0) return null

  // Sort by distance (asc)
  candidates.sort((a, b) => a.distance - b.distance)

  const best = candidates[0]
  if (!best) return null

  // Pick the closest one
  console.log(
    `[codegen/edit] Found ${candidates.length} candidates. Best match distance: ${best.distance}`
  )
  return best.node
}

function extractQuoteStyle(node: ts.Node, sourceFile: ts.SourceFile): string {
  const text = node.getText(sourceFile)
  if (text.startsWith("'")) return "'"
  if (text.startsWith('"')) return '"'
  if (text.startsWith("`")) return "`"
  return '"' // Default
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { file, line, original, replacement } = body

    if (!file || !original || !replacement) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 })
    }

    const safeBase = path.normalize(TARGET_ROOT)
    const fullPath = path.resolve(safeBase, file)

    if (!fullPath.startsWith(safeBase)) {
      return NextResponse.json({ error: "Invalid file path" }, { status: 403 })
    }

    try {
      await fs.access(fullPath)
    } catch {
      return NextResponse.json({ error: "File not found" }, { status: 404 })
    }

    const content = await fs.readFile(fullPath, "utf-8")

    // 1. Parse AST
    const sourceFile = ts.createSourceFile(
      file,
      content,
      ts.ScriptTarget.Latest,
      true
    )

    // 2. Find Node
    // STAGE 1: Focused Search Only (Line +/- 30)
    // We increase tolerance to handle significant sourcemap drift (e.g. 18-20 lines off)
    // while still ensuring we are editing the intended section of the file.
    const targetNode = findTargetNode(sourceFile, line || 1, original, 30)

    if (!targetNode) {
      return NextResponse.json(
        {
          error:
            "Could not find text node within line range (+/- 30 lines). Global search disabled for safety.",
          details: { line, original },
        },
        { status: 404 }
      )
    }

    // 3. Patch
    const start = targetNode.getStart(sourceFile)
    const end = targetNode.getEnd()

    let replacementText = replacement

    if (
      ts.isStringLiteral(targetNode) ||
      ts.isNoSubstitutionTemplateLiteral(targetNode)
    ) {
      // Preserve quotes for string literals
      const quote = extractQuoteStyle(targetNode, sourceFile)
      replacementText = `${quote}${replacement}${quote}`
    }

    // Perform replacement
    const newContent =
      content.slice(0, start) + replacementText + content.slice(end)

    await fs.writeFile(fullPath, newContent, "utf-8")
    return NextResponse.json({
      success: true,
      method: "ast_patch",
      nodeType: ts.SyntaxKind[targetNode.kind],
    })
  } catch (error) {
    console.error("[codegen/edit] Error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Error" },
      { status: 500 }
    )
  }
}
