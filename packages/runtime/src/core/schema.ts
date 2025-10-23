import { z } from "zod";
import { parsePhoneNumberFromString } from "libphonenumber-js";
import type { Form, Question, AddressData } from "../schema";
import { AddressSchema } from "../schema";
import type { RuntimeValues } from "../types";

type ValidationRuleLike = {
  value?: unknown;
  message?: string;
};

type AnyQuestion = Question & Record<string, unknown>;

const FILE_DESCRIPTOR_SCHEMA = z.object({
  url: z.string().url(),
  name: z.string(),
  size: z.number().nonnegative(),
  mimeType: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});

function extractValidations(
  question: AnyQuestion,
): Record<string, ValidationRuleLike> {
  return (question.validations ?? {}) as Record<string, ValidationRuleLike>;
}

function ruleMessage(rule: ValidationRuleLike | undefined, fallback: string) {
  return typeof rule?.message === "string" && rule.message.length > 0
    ? rule.message
    : fallback;
}

function requiredRule(rules: Record<string, ValidationRuleLike>) {
  const raw = rules.required;
  if (!raw) return false;
  if (typeof raw.value === "boolean") return raw.value;
  if (typeof raw === "boolean") return raw;
  return Boolean(raw.value);
}

function withOptional(schema: z.ZodTypeAny, required: boolean): z.ZodTypeAny {
  return required ? schema : schema.optional().nullable();
}

function buildTextSchema(question: AnyQuestion): z.ZodTypeAny {
  const rules = extractValidations(question);
  const format = (question.type as Record<string, unknown>)?.["format"];
  let base = z.string();

  switch (format) {
    case "tel": {
      // Validate international phone numbers (best-effort). Empty values are handled by required/optional.
      const phone = z.string().refine(
        (val) => {
          if (val == null) return false;
          const v = String(val).trim();
          if (v.length === 0) return false; // required decides allowance; we'll skip if optional later
          // Ensure leading + for parsing; strip spaces and common separators
          const digits = v.replace(/[^0-9+]/g, "");
          const plusForm = digits.startsWith("+") ? digits : `+${digits}`;
          try {
            const parsed = parsePhoneNumberFromString(plusForm);
            return Boolean(parsed && parsed.isValid());
          } catch {
            return false;
          }
        },
        ruleMessage(rules.pattern, "Please enter a valid phone number."),
      );
      return withOptional(phone, requiredRule(rules));
    }
    case "email":
      base = base.email(
        ruleMessage(rules.pattern, "Please enter a valid email address."),
      );
      break;
    case "url":
      base = base.url(ruleMessage(rules.pattern, "Please enter a valid URL."));
      break;
    case "number":
      return buildNumberSchema(question);
    default:
      break;
  }

  if (typeof rules.minLength?.value === "number") {
    base = base.min(
      rules.minLength.value,
      ruleMessage(
        rules.minLength,
        `Must be at least ${rules.minLength.value} characters.`,
      ),
    );
  }

  if (typeof rules.maxLength?.value === "number") {
    base = base.max(
      rules.maxLength.value,
      ruleMessage(
        rules.maxLength,
        `Must be at most ${rules.maxLength.value} characters.`,
      ),
    );
  }

  if (typeof rules.pattern?.value === "string") {
    try {
      base = base.regex(
        new RegExp(rules.pattern.value),
        ruleMessage(rules.pattern, "Value does not match the expected format."),
      );
    } catch {
      // Ignore invalid regex configuration.
    }
  }

  return withOptional(base, requiredRule(rules));
}

function buildNumberSchema(question: AnyQuestion): z.ZodTypeAny {
  const rules = extractValidations(question);
  const numeric = z.preprocess(
    (value) => {
      if (value === "" || value === null || value === undefined) return value;
      if (typeof value === "number") return value;
      if (typeof value === "string") {
        const parsed = Number(value);
        if (!Number.isNaN(parsed)) return parsed;
      }
      return value;
    },
    z.number({ invalid_type_error: "Please enter a number." }),
  );

  return withOptional(numeric, requiredRule(rules));
}

function toEnum(
  options: Array<Record<string, unknown>> | undefined,
): z.ZodTypeAny {
  if (!options || options.length === 0) return z.string();
  const labels = options.map((option) =>
    typeof option.value === "string" ? option.value : String(option.value),
  );
  const [head, ...rest] = labels;
  return z.enum([head, ...rest] as [string, ...string[]]);
}

function buildChoiceSchema(question: AnyQuestion): z.ZodTypeAny {
  const rules = extractValidations(question);
  const type = question.type as Record<string, unknown>;
  const options = type.options as Array<Record<string, unknown>> | undefined;

  if (type.name === "multipleChoice") {
    const baseArray = z.array(toEnum(options));
    let configured = baseArray;
    if (typeof rules.minSelections?.value === "number") {
      configured = configured.min(
        rules.minSelections.value,
        ruleMessage(
          rules.minSelections,
          `Select at least ${rules.minSelections.value} options.`,
        ),
      );
    }
    if (typeof rules.maxSelections?.value === "number") {
      configured = configured.max(
        rules.maxSelections.value,
        ruleMessage(
          rules.maxSelections,
          `Select at most ${rules.maxSelections.value} options.`,
        ),
      );
    }
    return withOptional(configured, requiredRule(rules));
  }

  const single = toEnum(options);
  return withOptional(single, requiredRule(rules));
}

function buildRatingSchema(question: AnyQuestion): z.ZodTypeAny {
  const rules = extractValidations(question);
  const config = (question.type as Record<string, any>)?.config ?? {};
  let base = z.number();

  if (typeof config.min === "number") {
    base = base.min(
      config.min,
      ruleMessage(rules.min, `Must be at least ${config.min}.`),
    );
  }
  if (typeof config.max === "number") {
    base = base.max(
      config.max,
      ruleMessage(rules.max, `Must be at most ${config.max}.`),
    );
  }

  return withOptional(base, requiredRule(rules));
}

function buildLinearScaleSchema(question: AnyQuestion): z.ZodTypeAny {
  const rules = extractValidations(question);
  const config = (question.type as Record<string, any>)?.config ?? {};
  let base = z.number();

  if (typeof config.start === "number") {
    base = base.min(
      config.start,
      ruleMessage(rules.min, `Must be at least ${config.start}.`),
    );
  }
  if (typeof config.end === "number") {
    base = base.max(
      config.end,
      ruleMessage(rules.max, `Must be at most ${config.end}.`),
    );
  }

  return withOptional(base, requiredRule(rules));
}

function buildLikertSchema(question: AnyQuestion): z.ZodTypeAny {
  const rules = extractValidations(question);
  const options = (question.type as Record<string, any>)?.options as
    | string[]
    | undefined;

  if (!options || options.length === 0) {
    return withOptional(z.string(), requiredRule(rules));
  }

  const [head, ...rest] = options;
  const likert = z.enum([head, ...rest] as [string, ...string[]]);
  return withOptional(likert, requiredRule(rules));
}

function buildRankingSchema(question: AnyQuestion): z.ZodTypeAny {
  const rules = extractValidations(question);
  const ranking = z.array(z.string());
  return withOptional(ranking, requiredRule(rules));
}

function buildDateSchema(question: AnyQuestion): z.ZodTypeAny {
  const rules = extractValidations(question);
  const format = (question.type as Record<string, unknown>)?.["format"];

  if (format === "dateRange") {
    const range = z.object({
      start: z.string(),
      end: z.string(),
    });
    return withOptional(range, requiredRule(rules));
  }

  return withOptional(z.string(), requiredRule(rules));
}

function buildFileUploadSchema(question: AnyQuestion): z.ZodTypeAny {
  const rules = extractValidations(question);
  const maxFiles = rules.maxFiles?.value;

  if (typeof maxFiles === "number" && maxFiles > 1) {
    const arraySchema = z
      .array(FILE_DESCRIPTOR_SCHEMA)
      .max(
        maxFiles,
        ruleMessage(rules.maxFiles, `Attach up to ${maxFiles} files.`),
      );
    return withOptional(arraySchema, requiredRule(rules));
  }

  return withOptional(FILE_DESCRIPTOR_SCHEMA, requiredRule(rules));
}

function buildAddressSchema(question: AnyQuestion): z.ZodTypeAny {
  const rules = extractValidations(question);
  return withOptional(
    AddressSchema as z.ZodType<AddressData>,
    requiredRule(rules),
  );
}

function buildSignatureSchema(question: AnyQuestion): z.ZodTypeAny {
  const rules = extractValidations(question);
  return withOptional(z.string(), requiredRule(rules));
}

function schemaForQuestion(question: Question): z.ZodTypeAny {
  const q = question as AnyQuestion;
  const typeName = (q.type as Record<string, unknown>)?.["name"];

  switch (typeName) {
    case "text":
      return buildTextSchema(q);
    case "singleChoice":
    case "multipleChoice":
      return buildChoiceSchema(q);
    case "rating":
      return buildRatingSchema(q);
    case "linearScale":
      return buildLinearScaleSchema(q);
    case "likertScale":
      return buildLikertSchema(q);
    case "ranking":
      return buildRankingSchema(q);
    case "date":
      return buildDateSchema(q);
    case "fileUpload":
      return buildFileUploadSchema(q);
    case "address":
      return buildAddressSchema(q);
    case "signature":
      return buildSignatureSchema(q);
    default:
      // TODO(runtime): add dedicated builders for remaining question types.
      return z.any();
  }
}

export function buildRuntimeSchema(
  form: Form,
): z.ZodObject<Record<string, z.ZodTypeAny>> {
  const shape: Record<string, z.ZodTypeAny> = {};
  for (const question of form.questions) {
    shape[question.id] = schemaForQuestion(question);
  }
  return z.object(shape);
}

export function createDefaultValues(
  form: Form,
  overrides: Partial<RuntimeValues> = {},
): RuntimeValues {
  return form.questions.reduce<RuntimeValues>((acc, question) => {
    if (overrides[question.id] !== undefined) {
      acc[question.id] = overrides[question.id]!;
      return acc;
    }
    if ((question as AnyQuestion).defaultValue !== undefined) {
      acc[question.id] = (question as AnyQuestion).defaultValue;
      return acc;
    }
    const typeName = (question.type as Record<string, unknown>)?.["name"];
    switch (typeName) {
      case "multipleChoice":
      case "ranking":
        acc[question.id] = [];
        break;
      case "fileUpload":
      case "address":
      case "signature":
        acc[question.id] = null;
        break;
      default:
        break;
    }
    return acc;
  }, {});
}
