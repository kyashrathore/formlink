import logger from "@/app/lib/logger"
import Ajv, { ValidateFunction } from "ajv"
import addFormats from "ajv-formats"
import { z } from "zod"
import { getComposioClient, isComposioEnabled } from "./composio-client"
import { ActionExecutionError } from "./errors"
import { CURATED_ACTIONS, getActionDescriptor } from "./registry"

type ToolSchemaRecord = {
  schema: Record<string, unknown> | null
  fetchedAt: number
}

const SCHEMA_CACHE = new Map<string, ToolSchemaRecord>()
const VALIDATOR_CACHE = new Map<string, ValidateFunction>()

const ajv = new Ajv({ allErrors: true, strict: false })
try {
  addFormats(ajv)
} catch (error) {
  // ajv-formats is optional; ignore failure if not available
  if (process.env.NODE_ENV === "development") {
    console.warn("[actions] ajv-formats could not be registered", error)
  }
}

function toJsonSchemaFromInputParameters(
  inputParams: any
): Record<string, unknown> | null {
  if (!inputParams || typeof inputParams !== "object") return null
  const properties: Record<string, any> = {}
  const required: string[] = []
  for (const [key, spec] of Object.entries<any>(inputParams)) {
    const t = (spec?.type && String(spec.type)) || undefined
    const desc = spec?.description
    const ex = spec?.example
    const enums = Array.isArray(spec?.enum) ? spec.enum : undefined
    const prop: Record<string, unknown> = {}
    if (t) prop.type = t
    if (desc) prop.description = desc
    if (ex !== undefined) prop.examples = [ex]
    if (enums) prop.enum = enums
    properties[key] = prop
    if (spec?.required === true) required.push(key)
  }
  const schema: Record<string, unknown> = {
    type: "object",
    properties,
  }
  if (required.length) (schema as any).required = required
  return schema
}

function extractJsonSchema(definition: any): {
  schema: Record<string, unknown> | null
  source?: string
  details?: Array<{
    key: string
    present: boolean
    type?: string
    hasProperties?: boolean
    hasInputObject?: boolean
  }>
} {
  if (!definition || typeof definition !== "object") {
    return { schema: null, details: [{ key: "definition", present: false }] }
  }

  const keys: Array<keyof any> = [
    "parameters",
    "input_parameters",
    "input_schema",
    "inputSchema",
    "schema",
    "args_schema",
    "arguments",
  ]
  const details: Array<{
    key: string
    present: boolean
    type?: string
    hasProperties?: boolean
    hasInputObject?: boolean
  }> = []

  for (const key of keys) {
    const candidate = (definition as any)[key]
    const present = Boolean(candidate)
    const type = present ? typeof candidate : undefined
    const hasProperties = Boolean(
      candidate?.properties ||
        candidate?.$schema ||
        candidate?.type === "object"
    )
    const hasInputObject = Boolean(
      candidate?.input && typeof candidate.input === "object"
    )
    details.push({
      key: String(key),
      present,
      type,
      hasProperties,
      hasInputObject,
    })

    if (!present) continue
    if (key === "input_parameters") {
      const converted = toJsonSchemaFromInputParameters(candidate)
      if (converted) return { schema: converted, source: String(key), details }
    }
    if (hasProperties) {
      return { schema: candidate, source: String(key), details }
    }
    if (hasInputObject) {
      const nested = candidate.input
      const nestedHas = Boolean(
        nested?.type === "object" || nested?.$schema || nested?.properties
      )
      if (nestedHas) {
        return { schema: nested, source: String(key) + ".input", details }
      }
    }
  }

  // Check common nested containers (e.g., OpenAI function tools)
  const nestedPaths: string[][] = [
    ["function", "parameters"],
    ["function", "input_parameters"],
    ["function", "schema"],
    ["function", "args_schema"],
    ["function", "arguments"],
    ["function", "input"],
    ["tool", "parameters"],
    ["tool", "input_parameters"],
    ["tool", "schema"],
    ["tool", "args_schema"],
    ["tool", "arguments"],
    ["tool", "input"],
  ]

  const getNested = (obj: any, path: string[]) =>
    path.reduce(
      (acc, key) => (acc && typeof acc === "object" ? acc[key] : undefined),
      obj
    )

  for (const path of nestedPaths) {
    const candidate = getNested(definition, path)
    const present = Boolean(candidate)
    const type = present ? typeof candidate : undefined
    const hasProperties = Boolean(
      candidate?.properties ||
        candidate?.$schema ||
        candidate?.type === "object"
    )
    const hasInputObject = Boolean(
      candidate?.input && typeof candidate.input === "object"
    )
    details.push({
      key: path.join("."),
      present,
      type,
      hasProperties,
      hasInputObject,
    })
    if (!present) continue
    if (path[path.length - 1] === "input_parameters") {
      const converted = toJsonSchemaFromInputParameters(candidate)
      if (converted)
        return { schema: converted, source: path.join("."), details }
    }
    if (hasProperties) {
      return { schema: candidate, source: path.join("."), details }
    }
    if (hasInputObject) {
      const nested = candidate.input
      const nestedHas = Boolean(
        nested?.type === "object" || nested?.$schema || nested?.properties
      )
      if (nestedHas) {
        return { schema: nested, source: path.join(".") + ".input", details }
      }
    }
  }

  return { schema: null, details }
}

export async function getToolSchema(toolSlug: string) {
  const cached = SCHEMA_CACHE.get(toolSlug)
  if (cached) return cached.schema

  if (!isComposioEnabled()) {
    logger.info?.(
      "[actions][schema] composio disabled; returning null schema",
      {
        toolSlug,
      }
    )
    SCHEMA_CACHE.set(toolSlug, { schema: null, fetchedAt: Date.now() })
    return null
  }

  try {
    const client = getComposioClient()
    const method = (client as any).getToolDefinition
    if (typeof method !== "function") {
      throw new ActionExecutionError(
        "Composio client cannot fetch tool schema",
        {
          status: 500,
          provider: "composio",
        }
      )
    }
    const definition = await client.getToolDefinition({ toolSlug })
    const topKeys =
      definition && typeof definition === "object"
        ? Object.keys(definition as any)
        : []
    const { schema, source, details } = extractJsonSchema(definition)
    if (schema) {
      logger.info?.("[actions][schema] extracted tool schema", {
        toolSlug,
        source,
        topKeys,
      })
    } else {
      logger.info?.("[actions][schema] no schema detected for tool", {
        toolSlug,
        topKeys,
        candidates: details,
      })
    }
    SCHEMA_CACHE.set(toolSlug, { schema, fetchedAt: Date.now() })
    return schema
  } catch (error: unknown) {
    SCHEMA_CACHE.set(toolSlug, { schema: null, fetchedAt: Date.now() })
    const message = error instanceof Error ? error.message : String(error)
    logger.warn?.("[actions][schema] failed to fetch tool schema", {
      toolSlug,
      error: message,
    })
    return null
  }
}

function compileValidator(toolSlug: string, schema: Record<string, unknown>) {
  const cacheKey = `${toolSlug}`
  let validator = VALIDATOR_CACHE.get(cacheKey)
  if (!validator) {
    validator = ajv.compile(schema)
    VALIDATOR_CACHE.set(cacheKey, validator)
  }
  return validator
}

export async function validateActionParameters(
  toolSlug: string,
  params: Record<string, unknown>
) {
  const schema = await getToolSchema(toolSlug)
  if (!schema) {
    return { valid: true as const }
  }

  try {
    const validate = compileValidator(toolSlug, schema)
    const ok = validate(params)
    if (ok) {
      return { valid: true as const }
    }
    const messages = (validate.errors || []).map((error) => {
      const dataPath = error.instancePath || error.schemaPath
      return dataPath ? `${dataPath}: ${error.message}` : error.message
    })
    return {
      valid: false as const,
      errors: messages.filter(Boolean) as string[],
    }
  } catch (error: unknown) {
    return {
      valid: false as const,
      errors: [
        error instanceof Error
          ? error.message
          : "Parameter validation failed unexpectedly",
      ],
    }
  }
}

export function getActionDescriptorSummary(toolSlug: string) {
  const descriptor = getActionDescriptor(toolSlug)
  if (!descriptor) return null
  return descriptor
}

// View-scoped required params (per slug)
// Deprecated: Curated per-view param validation removed in favor of provider schema.
