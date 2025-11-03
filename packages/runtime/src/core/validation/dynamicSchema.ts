import { z } from "zod";
import type { Form } from "../../schema";
import type { RuntimeValues } from "../../types";
import type { FormlinkFlow } from "../formlinkFlow";
import { buildRuntimeSchema } from "../schema";

export function buildDynamicSchema(
  form: Form,
  engine: FormlinkFlow,
  values: RuntimeValues,
  mode: "typeform" | "classic",
): z.ZodObject<Record<string, z.ZodTypeAny>> {
  const base = buildRuntimeSchema(form);
  const shape = { ...base.shape } as Record<string, z.ZodTypeAny>;

  // Compute eligibility set from routing engine
  let eligibleIds: string[] = [];
  try {
    if (mode === "typeform") {
      eligibleIds = Array.from(engine.visibleSet(values, "typeform"));
    } else {
      eligibleIds = engine.path(values);
    }
  } catch {
    eligibleIds = form.questions.map((q) => q.id);
  }
  const eligibleSet = new Set(eligibleIds);

  // For ineligible fields: allow undefined/null but still type-check if provided.
  // For eligible fields: keep base schema as-is (includes required rules).
  for (const q of form.questions) {
    const id = q.id;
    if (!eligibleSet.has(id)) {
      const s = shape[id];
      if (s) shape[id] = s.optional();
    }
  }
  return z.object(shape);
}
