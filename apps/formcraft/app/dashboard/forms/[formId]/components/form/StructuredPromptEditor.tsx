"use client"

import { XMLBuilder, XMLValidator } from "fast-xml-parser"
import { ChevronDown, ChevronRight, Code, Eye } from "lucide-react"
import React, { useEffect, useRef, useState } from "react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"

type StructuredPromptEditorProps = {
  initialContent?: string
  onChange?: (xml: string) => void
  className?: string
  label?: string
  description?: string
  height?: string
}

const StructuredPromptEditor: React.FC<StructuredPromptEditorProps> = ({
  initialContent = "",
  onChange,
  className = "",
  label = "",
  description = "",
  height = "300px",
}) => {
  const [nodes, setNodes] = useState<any[]>([])
  const [viewMode, setViewMode] = useState<"visual" | "code">("visual")
  const [rawXml, setRawXml] = useState(initialContent)
  const [editingNodes, setEditingNodes] = useState<Record<string, boolean>>({})
  const [editingHeights, setEditingHeights] = useState<Record<string, number>>(
    {}
  )
  const textAreaRefs = useRef<Record<string, HTMLTextAreaElement | null>>({})
  const viewRefs = useRef<Record<string, HTMLDivElement | null>>({})

  // Convert bare '&' in text to '&amp;' while leaving valid entities intact
  const sanitizeBareAmpersands = (s: string) =>
    typeof s === "string" ? s.replace(/&(?!#?[a-zA-Z0-9]+;)/g, "&amp;") : s

  const dedentText = (text: string) => {
    const normalized = text.replace(/\r\n?/g, "\n")
    // Trim a single leading and trailing newline to avoid accidental code blocks
    const trimmedEdges = normalized.replace(/^\n/, "").replace(/\n$/, "")
    const lines = trimmedEdges.split("\n")
    const nonEmpty = lines.filter((l) => l.trim().length > 0)
    const indents = nonEmpty.map((l) => l.match(/^\s*/)?.[0].length || 0)
    const minIndent = indents.length ? Math.min(...indents) : 0
    const dedented =
      minIndent > 0
        ? lines.map((l) => l.slice(minIndent)).join("\n")
        : trimmedEdges
    return dedented
  }

  const stripCdata = (text: string) => {
    // Remove any number of nested CDATA wrappers while preserving inner content
    let out = text
    const open = /<!\[CDATA\[/g
    const close = /\]\]>/g
    // Fast path: if no markers, return as-is
    if (!out.includes("<![CDATA[") && !out.includes("]]>")) return out
    // Remove all occurrences of the wrappers; nested cases become no-ops
    out = out.replace(open, "").replace(close, "")
    return out
  }

  // Minimal remark plugin to treat single newlines as <br/>
  // (avoids needing the external 'remark-breaks' package)
  const remarkHardBreaks = () => (tree: any) => {
    const visit = (node: any) => {
      if (!node) return
      if (Array.isArray(node.children)) {
        // Iterate over a copy, since we'll splice
        for (let i = 0; i < node.children.length; i++) {
          const child = node.children[i]
          if (
            child &&
            child.type === "text" &&
            typeof child.value === "string" &&
            child.value.includes("\n")
          ) {
            const parts = child.value.split("\n")
            const next: any[] = []
            parts.forEach((part: string, idx: number) => {
              if (idx > 0) next.push({ type: "break" })
              if (part.length) next.push({ type: "text", value: part })
            })
            node.children.splice(i, 1, ...next)
            i += next.length - 1
          } else if (child && typeof child === "object") {
            visit(child)
          }
        }
      }
    }
    visit(tree)
    return tree
  }

  // Debounced code editor logic + validation banner
  const [codeError, setCodeError] = useState<string | null>(null)
  const debounceRef = useRef<number | null>(null)

  const handleCodeChange = (value: string) => {
    const sanitized = sanitizeBareAmpersands(value)
    setRawXml(sanitized)
    if (debounceRef.current) window.clearTimeout(debounceRef.current)
    debounceRef.current = window.setTimeout(() => {
      const res = XMLValidator.validate(sanitized)
      if (res !== true) {
        const msg =
          typeof res === "object" && (res as any).err
            ? `${(res as any).err.msg} at line ${(res as any).err.line}:col ${(res as any).err.col}`
            : "Invalid XML"
        setCodeError(msg)
        return
      }
      setCodeError(null)
      try {
        const parsed = parseXmlToNodes(sanitized)
        setNodes(parsed)
        onChange?.(sanitized)
      } catch {
        setCodeError("Failed to parse XML")
      }
    }, 200)
  }

  const parseXmlToNodes = (xmlString: string) => {
    const parser = new DOMParser()

    const hasParserError = (doc: Document) => {
      const name = doc.documentElement?.nodeName?.toLowerCase()
      return (
        name === "parsererror" ||
        doc.getElementsByTagName("parsererror").length > 0
      )
    }

    const doc = parser.parseFromString(xmlString || "<root></root>", "text/xml")
    if (hasParserError(doc)) {
      // Try to extract a readable message from the browser's parsererror markup
      const errNode = doc.getElementsByTagName("parsererror")[0]
      const errText = errNode?.textContent || "Invalid XML"
      throw new Error(errText)
    }

    const convertDomToNode = (element: Element, path = ""): any => {
      const children: any[] = []
      const attributes: Record<string, string> = {}

      if (element.attributes) {
        for (let i = 0; i < element.attributes.length; i++) {
          const attr = (element.attributes as any)[i] as Attr | undefined
          if (!attr) continue
          attributes[attr.name] = attr.value
        }
      }

      let textIndex = 0
      let elemIndex = 0
      for (let i = 0; i < element.childNodes.length; i++) {
        const child = (element.childNodes as any)[i] as ChildNode | undefined
        if (!child) continue
        if (child.nodeType === 1) {
          const idx = elemIndex++
          children.push(
            convertDomToNode(
              child as Element,
              `${path}/${element.nodeName}[${idx}]`
            )
          )
        } else if (
          (child.nodeType === 3 || child.nodeType === 4) &&
          child.textContent &&
          child.textContent.length
        ) {
          // Preserve markdown, but remove common XML indentation
          children.push({
            type: "text",
            content: dedentText(child.textContent),
            id: `${path}#text[${textIndex++}]`,
          })
        }
      }

      return {
        id: `${path || ""}/${element.nodeName}`,
        tag: element.nodeName,
        attributes,
        children,
        collapsed: false,
        path,
      }
    }

    const rootElement = doc.documentElement
    return rootElement ? [convertDomToNode(rootElement)] : []
  }

  // Build an FXP-compatible AST and serialize with XMLBuilder (escape-only, no CDATA emission)
  const nodesToXml = (nodeList: any[]): string => {
    if (!nodeList || nodeList.length === 0) return ""

    const toFxp = (node: any): any => {
      if (node.type === "text") {
        // Return plain string; builder will escape
        return stripCdata(node.content)
      }
      const obj: Record<string, any> = {}
      // Attributes
      const attrs = node.attributes || {}
      for (const [k, v] of Object.entries(attrs)) obj[`@_${k}`] = String(v)
      // Children
      const children: any[] = node.children || []
      const textOnly =
        children.length > 0 && children.every((c: any) => c.type === "text")
      if (textOnly) {
        obj["#text"] = children
          .map((c: any) => stripCdata(c.content))
          .join("\n")
      } else if (children.length > 0) {
        for (const child of children) {
          if (child.type === "text") {
            // Mixed content: collect into #text; multiple pieces -> join with space
            obj["#text"] =
              (obj["#text"] ? obj["#text"] + " " : "") +
              stripCdata(child.content)
          } else {
            const val = toFxp(child)
            if (obj[child.tag] === undefined) obj[child.tag] = val
            else if (Array.isArray(obj[child.tag])) obj[child.tag].push(val)
            else obj[child.tag] = [obj[child.tag], val]
          }
        }
      }
      return obj
    }

    const root = nodeList[0]
    const fxpAst: Record<string, any> = { [root.tag]: toFxp(root) }
    const builder = new XMLBuilder({
      ignoreAttributes: false,
      attributeNamePrefix: "@_",
      format: true,
    })
    return builder.build(fxpAst)
  }

  useEffect(() => {
    const sampleXml =
      initialContent ||
      `<config>
  <api-settings>
    <endpoint>https://api.example.com</endpoint>
    <timeout>30000</timeout>
    <retry-attempts>3</retry-attempts>
  </api-settings>
  <features>
    <authentication>Enable OAuth2 authentication with refresh token support</authentication>
    <caching>Implement Redis caching for frequently accessed endpoints</caching>
    <logging>Verbose logging for debugging and monitoring</logging>
  </features>
</config>`

    // Do NOT escape here — we want valid XML for parsing and validation
    const sanitized = sanitizeBareAmpersands(sampleXml)
    setRawXml(sanitized)
    try {
      setNodes(parseXmlToNodes(sanitized))
      setCodeError(null)
    } catch (e: any) {
      setCodeError(e?.message || "Invalid XML")
      setNodes([])
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialContent])

  // Do not auto-call onChange on every internal nodes update to avoid
  // feedback loops with controlled parents. Instead, call onChange only
  // in explicit user-edit handlers below.

  const toggleCollapse = (nodeId: string) => {
    const updateNode = (nodeList: any[]): any[] => {
      return nodeList.map((node) => {
        if (node.id === nodeId) {
          return { ...node, collapsed: !node.collapsed }
        }
        if (node.children) {
          return { ...node, children: updateNode(node.children) }
        }
        return node
      })
    }
    setNodes(updateNode(nodes))
  }

  const addEmptyTextChild = (elementId: string) => {
    const addToTree = (list: any[]): { next: any[]; newTextId?: string } => {
      let createdId: string | undefined
      const next = list.map((n) => {
        if (n.id === elementId && !n.type) {
          const textChildren = (n.children || []).filter(
            (c: any) => c.type === "text"
          )
          const newId = `${n.id}#text[${textChildren.length}]`
          createdId = newId
          const newChild = { type: "text", content: "", id: newId }
          return { ...n, children: [...(n.children || []), newChild] }
        }
        if (n.children) {
          const res = addToTree(n.children)
          if (res.newTextId) createdId = res.newTextId
          return { ...n, children: res.next }
        }
        return n
      })
      return { next, newTextId: createdId }
    }
    const res = addToTree(nodes)
    setNodes(res.next)
    if (res.newTextId) {
      setEditingNodes((prev) => ({ ...prev, [res.newTextId!]: true }))
    }
    // Do NOT call onChange here to avoid parent refresh killing focus.
    // rawXml will be updated after the first edit/blur via updateNodeContent.
  }

  const updateNodeContent = (nodeId: string, content: string) => {
    const applyUpdate = (nodeList: any[]): any[] =>
      nodeList.map((node) =>
        node.id === nodeId
          ? { ...node, content }
          : node.children
            ? { ...node, children: applyUpdate(node.children) }
            : node
      )

    const nextNodes = applyUpdate(nodes)
    setNodes(nextNodes)
    setRawXml(nodesToXml(nextNodes))
    setEditingNodes((prev) => ({ ...prev, [nodeId]: false }))
    if (onChange) {
      onChange(nodesToXml(nextNodes))
    }
  }

  const startEditing = (nodeId: string) => {
    // Measure the current rendered height to keep textarea consistent
    const viewEl = viewRefs.current[nodeId]
    const measured = viewEl
      ? Math.max(24, Math.ceil(viewEl.getBoundingClientRect().height))
      : undefined
    if (measured) {
      setEditingHeights((prev) => ({ ...prev, [nodeId]: measured }))
    }
    setEditingNodes((prev) => ({ ...prev, [nodeId]: true }))
  }

  const cancelEditing = (nodeId: string) => {
    setEditingNodes((prev) => ({ ...prev, [nodeId]: false }))
  }

  const renderNode = (node: any, depth = 0): React.ReactNode => {
    const hasChildren = node.children && node.children.length > 0
    const hasOnlyTextChildren =
      hasChildren && node.children.every((child: any) => child.type === "text")
    const indent = depth * 12
    const isEditing = editingNodes[node.id]

    if (node.type === "text") {
      return (
        <div key={node.id} className="group relative">
          {isEditing ? (
            <textarea
              ref={(el) => {
                textAreaRefs.current[node.id] = el
                if (el) {
                  // Initialize height based on measured view height or content scrollHeight
                  const target = Math.max(
                    editingHeights[node.id] || 0,
                    (() => {
                      el.style.height = "auto"
                      return el.scrollHeight
                    })()
                  )
                  el.style.height = target + "px"
                }
              }}
              autoFocus
              className="bg-background border-input focus:ring-ring focus:ring-offset-background w-full resize-none rounded-md border px-2 py-1 text-sm font-normal transition-all focus:ring-2 focus:ring-offset-1 focus:outline-none"
              defaultValue={stripCdata(node.content)}
              style={{
                minHeight: editingHeights[node.id]
                  ? `${editingHeights[node.id]}px`
                  : undefined,
                height: editingHeights[node.id]
                  ? `${editingHeights[node.id]}px`
                  : undefined,
              }}
              onChange={(e) => {
                e.currentTarget.style.height = "auto"
                e.currentTarget.style.height =
                  e.currentTarget.scrollHeight + "px"
              }}
              onBlur={(e) => updateNodeContent(node.id, e.currentTarget.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault()
                  updateNodeContent(
                    node.id,
                    (e.target as HTMLTextAreaElement).value
                  )
                }
                if (e.key === "Escape") {
                  cancelEditing(node.id)
                }
              }}
            />
          ) : (
            <div
              className="text-foreground hover:bg-accent/50 min-h-[24px] cursor-text rounded-md px-2 py-1 text-sm transition-colors"
              onClick={() => startEditing(node.id)}
              style={{ minHeight: "24px" }}
              ref={(el) => {
                viewRefs.current[node.id] = el
              }}
            >
              {node.content ? (
                <div className="text-sm">
                  <div className="prose prose-sm dark:prose-invert prose-p:my-1 prose-headings:mt-3 prose-headings:mb-2 prose-strong:font-semibold prose-code:px-1 prose-code:py-0.5 prose-code:rounded-md prose-pre:my-2 prose-pre:p-3 prose-ul:my-1 prose-ol:my-1 prose-li:my-0.5 max-w-none">
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm, remarkHardBreaks]}
                    >
                      {stripCdata(node.content)}
                    </ReactMarkdown>
                  </div>
                </div>
              ) : null}
            </div>
          )}
        </div>
      )
    }

    return (
      <div key={node.id} style={{ marginLeft: `${indent}px` }}>
        <div className="group">
          <div className="mb-0.5 flex items-start gap-1">
            <button
              onClick={() =>
                hasChildren && !hasOnlyTextChildren && toggleCollapse(node.id)
              }
              className={`bg-secondary hover:bg-secondary/80 text-secondary-foreground inline-flex items-center gap-0.5 rounded-sm px-1.5 py-0.5 text-xs font-medium transition-colors ${
                hasChildren && !hasOnlyTextChildren ? "cursor-pointer" : ""
              }`}
            >
              {hasChildren &&
                !hasOnlyTextChildren &&
                (node.collapsed ? (
                  <ChevronRight className="h-3 w-3" />
                ) : (
                  <ChevronDown className="h-3 w-3" />
                ))}
              <span className="select-none">{node.tag}</span>
            </button>
          </div>

          {hasOnlyTextChildren && (
            <div className="border-border/40 ml-1 border-l-2 pl-2">
              {node.children.map((child: any) => renderNode(child, 0))}
            </div>
          )}

          {hasChildren && !hasOnlyTextChildren && !node.collapsed && (
            <div className="ml-1">
              {node.children.map((child: any) => renderNode(child, depth + 1))}
            </div>
          )}

          {!hasChildren && (
            <div className="ml-1 pl-2">
              <div
                className="text-foreground hover:bg-accent/50 min-h-[24px] cursor-text rounded-md px-2 py-1 text-sm transition-colors"
                style={{ minHeight: "24px" }}
                onClick={() => addEmptyTextChild(node.id)}
                title="Add text"
              />
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className={`space-y-2 ${className}`}>
      {label && (
        <label className="text-sm leading-none font-medium peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
          {label}
        </label>
      )}
      {description && (
        <p className="text-muted-foreground text-sm">{description}</p>
      )}

      <div className="border-input bg-background relative overflow-hidden rounded-md border">
        <div className="border-border bg-muted/30 flex items-center justify-between border-b px-3 py-2">
          <span className="text-muted-foreground text-xs font-medium">
            Structured Prompt Editor
          </span>
          <div className="flex gap-1">
            <button
              onClick={() => setViewMode("visual")}
              className={`rounded-sm p-1 transition-colors ${
                viewMode === "visual"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground hover:bg-background/50"
              }`}
              title="Visual mode"
            >
              <Eye className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => setViewMode("code")}
              className={`rounded-sm p-1 transition-colors ${
                viewMode === "code"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground hover:bg-background/50"
              }`}
              title="Code mode"
            >
              <Code className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        <div className="relative" style={{ height, maxHeight: height }}>
          {viewMode === "visual" ? (
            <div className="h-full overflow-x-hidden overflow-y-auto p-3">
              {nodes.map((node) => renderNode(node))}
            </div>
          ) : (
            <textarea
              className="h-full w-full resize-none border-0 bg-transparent p-3 font-mono text-xs focus:ring-0 focus:outline-none"
              value={rawXml}
              onChange={(e) => handleCodeChange(e.currentTarget.value)}
              spellCheck={false}
              placeholder="Enter XML content..."
            />
          )}
          {codeError && (
            <div className="absolute right-3 bottom-3 left-3 rounded border border-red-200 bg-red-50 px-2 py-1 text-xs text-red-600">
              {codeError}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default StructuredPromptEditor
