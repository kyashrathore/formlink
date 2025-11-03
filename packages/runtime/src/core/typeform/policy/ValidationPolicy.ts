import type { Form } from "../../../schema";
import type { FormlinkFlow } from "../../formlinkFlow";
import type { RuntimeValues } from "../../../types";
import { buildDynamicSchema } from "../../validation/dynamicSchema";
import { z } from "zod";

export function getDynamicSchema(
  form: Form,
  engine: FormlinkFlow,
  values: RuntimeValues,
  mode: "typeform" | "classic" = "typeform",
): z.ZodObject<Record<string, z.ZodTypeAny>> {
  return buildDynamicSchema(form, engine, values, mode);
}
