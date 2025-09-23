import { getModel } from "@/app/lib/ai/provider"
import { authErrorResponse, requireAuth } from "@/app/lib/middleware/auth"
import { verifyUserCanAccessFormVersion } from "@/app/lib/middleware/authorization"
import { faker } from "@faker-js/faker"
import { createServerClient } from "@formlink/db"
import { generateObject } from "ai"
import { cookies } from "next/headers"
import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"

type Body = {
  form_id?: string
  form_version_id?: string
  count?: number
}

// Schema for AI to analyze and map questions to data generation rules
const DataGenerationRuleSchema = z.object({
  questionId: z.string(),
  dataType: z.enum([
    "name",
    "email",
    "phone",
    "url",
    "number",
    "date",
    "dateRange",
    "address",
    "choice",
    "multiChoice",
    "rating",
    "scale",
    "text",
    "paragraph",
    "boolean",
    "country",
    "city",
    "state",
    "zipcode",
    "jobTitle",
    "company",
    "department",
    "color",
    "product",
    "feedback",
    "file",
    "signature",
  ]),
  constraints: z.object({
    min: z.number().optional(),
    max: z.number().optional(),
    minLength: z.number().optional(),
    maxLength: z.number().optional(),
    options: z.array(z.string()).optional(),
    format: z.string().optional(),
    pattern: z.string().optional(),
    required: z.boolean().optional(),
    multiSelect: z.boolean().optional(),
    minSelections: z.number().optional(),
    maxSelections: z.number().optional(),
    yearRange: z
      .object({
        min: z.number().optional(),
        max: z.number().optional(),
      })
      .optional(),
    biasTowards: z
      .enum(["positive", "negative", "neutral", "high", "low", "middle"])
      .optional(),
    examples: z.array(z.string()).optional(),
    category: z.string().optional(),
  }),
})

const DataGenerationSchemaResponse = z.object({
  rules: z.array(DataGenerationRuleSchema),
  correlations: z
    .array(
      z.object({
        questionIds: z.array(z.string()),
        relationship: z.string(),
      })
    )
    .optional(),
})

// Generate contextually appropriate response from AI-provided examples
function generateContextualResponse(examples: string[]): string | null {
  if (!examples || examples.length === 0) return null
  return faker.helpers.arrayElement(examples)
}

// Generate data based on the AI-analyzed rules
function generateDataFromRule(
  rule: z.infer<typeof DataGenerationRuleSchema>
): any {
  const { dataType, constraints } = rule

  switch (dataType) {
    case "name":
      if (constraints.category === "first") return faker.person.firstName()
      if (constraints.category === "last") return faker.person.lastName()
      if (constraints.category === "full") return faker.person.fullName()
      return faker.person.fullName()

    case "email":
      return faker.internet.email()

    case "phone":
      // Generate clean phone numbers without extensions
      const phoneFormats = [
        "(###) ###-####",
        "###-###-####",
        "+1 ### ### ####",
        "### ### ####",
      ]
      return faker.helpers.replaceSymbols(
        faker.helpers.arrayElement(phoneFormats)
      )

    case "url":
      // Generate more realistic URLs based on context
      if (
        constraints.category === "portfolio" ||
        constraints.category === "website"
      ) {
        const domains = [
          "dev",
          "design",
          "studio",
          "works",
          "portfolio.com",
          "mywork.io",
        ]
        return `https://${faker.internet.username()}.${faker.helpers.arrayElement(domains)}`
      }
      if (constraints.category === "github") {
        return `https://github.com/${faker.internet.username()}`
      }
      if (constraints.category === "linkedin") {
        return `https://linkedin.com/in/${faker.internet.username()}`
      }
      return faker.internet.url()

    case "number":
      if (constraints.min !== undefined && constraints.max !== undefined) {
        return faker.number.int({ min: constraints.min, max: constraints.max })
      }
      return faker.number.int({ min: 1, max: 100 })

    case "date":
      if (constraints.yearRange) {
        const yearsAgo = constraints.yearRange.max || 1
        const yearsAgoMin = constraints.yearRange.min || 0
        return faker.date
          .between({
            from: new Date(Date.now() - yearsAgo * 365 * 24 * 60 * 60 * 1000),
            to: new Date(Date.now() - yearsAgoMin * 365 * 24 * 60 * 60 * 1000),
          })
          .toISOString()
          .split("T")[0]
      }
      return faker.date.recent({ days: 30 }).toISOString().split("T")[0]

    case "dateRange":
      const start = faker.date.recent({ days: 90 })
      const end = faker.date.soon({ days: 30, refDate: start })
      return {
        start: start.toISOString().split("T")[0],
        end: end.toISOString().split("T")[0],
      }

    case "address":
      return {
        street: faker.location.streetAddress(),
        city: faker.location.city(),
        state: faker.location.state(),
        zip: faker.location.zipCode(),
        country: faker.location.country(),
      }

    case "choice":
      if (constraints.options && constraints.options.length > 0) {
        return faker.helpers.arrayElement(constraints.options)
      }
      return null

    case "multiChoice":
      if (constraints.options && constraints.options.length > 0) {
        const min = constraints.minSelections || 1
        const max =
          constraints.maxSelections || Math.min(3, constraints.options.length)
        const count = faker.number.int({ min, max })
        return faker.helpers.arrayElements(constraints.options, count)
      }
      return []

    case "rating":
      const ratingMin = constraints.min || 1
      const ratingMax = constraints.max || 5
      if (
        constraints.biasTowards === "positive" ||
        constraints.biasTowards === "high"
      ) {
        return faker.helpers.weightedArrayElement(
          Array.from({ length: ratingMax - ratingMin + 1 }, (_, i) => ({
            weight: Math.pow(1.5, i),
            value: ratingMin + i,
          }))
        )
      }
      return faker.number.int({ min: ratingMin, max: ratingMax })

    case "scale":
      const scaleMin = constraints.min || 1
      const scaleMax = constraints.max || 10
      if (constraints.biasTowards === "high") {
        const midPoint = Math.floor((scaleMax + scaleMin) / 2)
        return faker.number.int({ min: midPoint, max: scaleMax })
      }
      return faker.number.int({ min: scaleMin, max: scaleMax })

    case "boolean":
      return faker.datatype.boolean()

    case "country":
      return faker.location.country()

    case "city":
      return faker.location.city()

    case "state":
      return faker.location.state()

    case "zipcode":
      return faker.location.zipCode()

    case "jobTitle":
      return faker.person.jobTitle()

    case "company":
      return faker.company.name()

    case "department":
      return faker.commerce.department()

    case "color":
      return faker.color.human()

    case "product":
      return faker.commerce.productName()

    case "feedback":
    case "paragraph":
      // Use AI-generated examples for contextual responses
      if (constraints.examples && constraints.examples.length > 0) {
        const contextualResponse = generateContextualResponse(
          constraints.examples
        )
        if (contextualResponse) return contextualResponse
      }

      if (constraints.minLength || constraints.maxLength) {
        const minWords = Math.floor((constraints.minLength || 10) / 5)
        const maxWords = Math.floor((constraints.maxLength || 200) / 5)
        return faker.lorem.words({ min: minWords, max: maxWords })
      }
      return faker.lorem.paragraph()

    case "file":
      // Generate a fake file name
      const fileTypes = ["pdf", "docx", "txt", "png", "jpg"]
      return `${faker.system.fileName()}.${faker.helpers.arrayElement(fileTypes)}`

    case "signature":
      // Generate a signature representation
      return `Signature_${faker.person.fullName().replace(/ /g, "_")}_${faker.number.int({ min: 1000, max: 9999 })}`

    case "text":
    default:
      // Use AI-generated examples for contextual responses
      if (constraints.examples && constraints.examples.length > 0) {
        const contextualResponse = generateContextualResponse(
          constraints.examples
        )
        if (contextualResponse) return contextualResponse
      }

      if (constraints.minLength || constraints.maxLength) {
        const min = Math.floor((constraints.minLength || 1) / 5)
        const max = Math.floor((constraints.maxLength || 20) / 5)
        return faker.lorem.words({ min, max })
      }
      return faker.lorem.words({ min: 1, max: 5 })
  }
}

export async function POST(req: NextRequest) {
  try {
    // Check if test data feature is enabled
    const testDataEnabled =
      process.env.NEXT_PUBLIC_ENABLE_TESTDATA?.toLowerCase() === "true"

    if (!testDataEnabled) {
      return NextResponse.json(
        { error: "Test data feature is not enabled" },
        { status: 403 }
      )
    }

    let auth
    try {
      auth = await requireAuth(req)
    } catch (error) {
      return authErrorResponse({
        name: "AuthError",
        message:
          error instanceof Error ? error.message : "Authentication failed",
        statusCode: 401,
      })
    }

    const body: Body = (await req.json().catch(() => ({}))) || {}
    const cookieStore = await cookies()
    const supabase = await createServerClient(cookieStore)

    // Resolve formVersionId
    let formVersionId = body.form_version_id || null
    if (!formVersionId && body.form_id) {
      const { data: formRow } = await supabase
        .from("forms")
        .select("current_published_version_id, current_draft_version_id")
        .eq("id", body.form_id)
        .single()
      formVersionId =
        (formRow as any)?.current_published_version_id ||
        (formRow as any)?.current_draft_version_id ||
        null
    }
    if (!formVersionId) {
      return NextResponse.json(
        { error: "Provide form_id or form_version_id" },
        { status: 400 }
      )
    }

    const hasAccess = await verifyUserCanAccessFormVersion(
      formVersionId,
      auth.user.id
    )
    if (!hasAccess) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
    }

    const { data: version } = await supabase
      .from("form_versions")
      .select("version_id, questions")
      .eq("version_id", formVersionId)
      .single()

    // Normalize questions
    let questions: any[] = []
    const rawQ = (version as any)?.questions
    if (Array.isArray(rawQ)) questions = rawQ
    else if (typeof rawQ === "string") {
      try {
        questions = JSON.parse(rawQ)
      } catch {
        questions = []
      }
    }

    const count = Math.min(Math.max(body.count ?? 100, 1), 1000)

    // Step 1: Use AI to analyze questions and create data generation rules
    console.warn("Analyzing form questions with AI...")
    const MODEL = getModel()

    let dataGenerationSchema: z.infer<typeof DataGenerationSchemaResponse>

    try {
      const { object } = await generateObject({
        model: MODEL,
        schema: DataGenerationSchemaResponse,
        system: `You are a form data analyst. Analyze each question and produce precise data-generation rules per question.

For every question, infer and output:
1) dataType: one of {name, email, phone, url, number, date, dateRange, address, choice, multiChoice, rating, scale, text, paragraph, boolean, country, city, state, zipcode, jobTitle, company, department, color, product, feedback, file, signature}.
2) constraints: include any that apply: {min, max, minLength, maxLength, options, format, pattern, required, multiSelect, minSelections, maxSelections, yearRange:{min,max}, biasTowards, category, examples}.
3) Keep constraints faithful to the question’s configuration. Do not invent options for choice fields.

Examples guidance (context-aware):
- Provide up to 10 short, diverse, realistic example answers in constraints.examples for questions that accept free text (text, paragraph, feedback, jobTitle, company, product, project/description-style prompts, etc.).
- Use the question’s label, description, and nearby context to tailor tone and content.
- Do not copy the question text; produce plausible answers. Keep examples concise
- Do not add examples for strict choice/multiChoice fields unless they are free-text by design.

Be specific about constraints when applicable:
- Age: min=18, max=100
- Experience years: min=0, max=50
- Ratings: typically 1–5 or 1–10; biasTowards may be high/low/positive/negative/neutral/middle
- URLs: categorize as 'portfolio', 'github', 'linkedin', or 'general'
- Dates: birth dates (20–80 years ago) vs recent dates (last 30 days), etc.

Also, identify any simple correlations between questions when obvious (e.g., seniority aligns with years of experience), but keep this concise.`,
        prompt: JSON.stringify({
          questions: questions.map((q) => ({
            id: q.id,
            label: q.label || q.title,
            type: q.name || q.type,
            format: q.format,
            display: q.display,
            options: q.options,
            config: q.config,
            required: q.required,
            validations: q.validations,
          })),
        }),
      })

      dataGenerationSchema = object
    } catch (error) {
      console.error("AI analysis failed, using fallback rules:", error)
      // Fallback to basic rules if AI fails
      dataGenerationSchema = {
        rules: questions.map((q) => ({
          questionId: q.id,
          dataType: determineBasicDataType(q),
          constraints: {
            options: q.options?.map((opt: any) =>
              typeof opt === "string" ? opt : opt.value || opt.label
            ),
            required: q.required,
            min: q.config?.min || q.config?.start,
            max: q.config?.max || q.config?.end,
          },
        })),
      }
    }

    // Step 2: Generate submissions
    const submissions: Array<{
      form_version_id: string
      status: "completed" | "in_progress" | "abandoned"
      created_at: string
      last_updated_at: string
      completed_at: string | null
      testmode: boolean
      user_id?: string
    }> = []

    for (let i = 0; i < count; i++) {
      // Generate submission with realistic timing
      const created = faker.date.recent({ days: 30 })
      const dayOfWeek = created.getDay()

      // Business hours bias for weekdays
      if (
        dayOfWeek >= 1 &&
        dayOfWeek <= 5 &&
        faker.datatype.boolean({ probability: 0.7 })
      ) {
        created.setHours(faker.number.int({ min: 9, max: 18 }))
        created.setMinutes(faker.number.int({ min: 0, max: 59 }))
      }

      // Realistic status distribution
      const status = faker.helpers.weightedArrayElement([
        { weight: 75, value: "completed" as const },
        { weight: 15, value: "in_progress" as const },
        { weight: 10, value: "abandoned" as const },
      ])

      // Completion times based on form complexity
      const baseTime = questions.length * 0.5 // 30 seconds per question average
      const variance = baseTime * 0.5
      const completionMinutes =
        status === "completed"
          ? Math.max(
              2,
              baseTime +
                faker.number.float({ min: -variance, max: variance * 2 })
            )
          : status === "abandoned"
            ? Math.max(1, baseTime * faker.number.float({ min: 0.1, max: 0.7 }))
            : 0

      const completedAt =
        status === "completed"
          ? new Date(created.getTime() + completionMinutes * 60 * 1000)
          : null

      const lastUpdated =
        status === "in_progress"
          ? new Date(
              created.getTime() +
                faker.number.float({
                  min: 1,
                  max: Math.max(1, completionMinutes * 0.5),
                }) *
                  60 *
                  1000
            )
          : completedAt || created

      submissions.push({
        form_version_id: formVersionId,
        status,
        created_at: created.toISOString(),
        last_updated_at: lastUpdated.toISOString(),
        completed_at: completedAt ? completedAt.toISOString() : null,
        testmode: true,
        user_id: auth.user.id,
      })
    }

    const { data: inserted, error: insErr } = await supabase
      .from("form_submissions")
      .insert(submissions as any)
      .select("submission_id, status")

    if (insErr) {
      return NextResponse.json(
        { error: "Failed to insert submissions", details: insErr.message },
        { status: 500 }
      )
    }

    // Step 3: Generate answers using the AI-created schema
    const answers: any[] = []
    const ruleMap = new Map(
      dataGenerationSchema.rules.map((r) => [r.questionId, r])
    )

    for (const sub of inserted || []) {
      const isComplete = (sub as any).status === "completed"

      // For incomplete submissions, answer only portion of questions
      const questionsToAnswer = isComplete
        ? questions
        : faker.helpers.arrayElements(
            questions,
            faker.number.int({
              min: Math.max(1, Math.floor(questions.length * 0.2)),
              max: Math.floor(questions.length * 0.8),
            })
          )

      for (const question of questionsToAnswer) {
        // Get the rule for this question
        let rule = ruleMap.get(question.id)
        if (!rule) continue

        // Ensure choice/multiChoice use the question's options if AI missed them
        if (
          (rule.dataType === "choice" || rule.dataType === "multiChoice") &&
          (!rule.constraints.options || rule.constraints.options.length === 0)
        ) {
          const normalizedOptions: string[] = Array.isArray(question.options)
            ? question.options.map((opt: any) =>
                typeof opt === "string"
                  ? opt
                  : (opt?.value ?? opt?.label ?? String(opt))
              )
            : []
          if (normalizedOptions.length) {
            rule = {
              ...rule,
              constraints: { ...rule.constraints, options: normalizedOptions },
            }
          }
        }

        // Skip some optional questions (10% chance)
        if (
          !rule.constraints.required &&
          faker.datatype.boolean({ probability: 0.1 })
        )
          continue

        // Generate data based on the rule
        const value = generateDataFromRule(rule)
        if (value === null || value === undefined) continue

        answers.push({
          submission_id: sub.submission_id,
          question_id: question.id,
          // Preserve native JSON types for jsonb column
          answer_value: value,
        })
      }
    }

    if (answers.length) {
      const { error: ansErr } = await supabase
        .from("form_answers")
        .insert(answers as any)
      if (ansErr) {
        // Best-effort cleanup to avoid orphan test submissions
        try {
          const submissionIds = (inserted || []).map(
            (s: any) => s.submission_id
          )
          if (submissionIds.length) {
            // Attempt delete (may be blocked by RLS)
            const { error: delErr } = await supabase
              .from("form_submissions")
              .delete()
              .in("submission_id", submissionIds)

            if (delErr) {
              // Fall back to marking them abandoned with a cleanup flag
              await supabase
                .from("form_submissions")
                .update({
                  status: "abandoned",
                  metadata: { cleanup_failed: true },
                } as any)
                .in("submission_id", submissionIds)
            }
          }
        } catch {
          // Ignore cleanup errors; we'll still return the original failure
        }

        return NextResponse.json(
          { error: "Failed to insert answers", details: ansErr.message },
          { status: 500 }
        )
      }
    }

    return NextResponse.json({
      success: true,
      submissions_created: inserted?.length || 0,
      answers_created: answers.length,
      data_rules_generated: dataGenerationSchema.rules.length,
      message: `Generated ${inserted?.length} realistic test submissions with ${answers.length} answers using AI-analyzed data patterns`,
    })
  } catch (e) {
    console.error("Error generating test data:", e)
    return NextResponse.json(
      {
        error: "Failed to generate test data",
        details: e instanceof Error ? e.message : "Unknown error",
      },
      { status: 500 }
    )
  }
}

// Fallback function to determine basic data type if AI fails
function determineBasicDataType(
  question: any
): z.infer<typeof DataGenerationRuleSchema>["dataType"] {
  const qType = question.name || question.type || "text"
  const qFormat = question.format
  const qLabel = (question.label || question.title || "").toLowerCase()

  if (qType === "singleChoice") return "choice"
  if (qType === "multipleChoice") return "multiChoice"
  if (qType === "rating") return "rating"
  if (qType === "linearScale") return "scale"
  if (qType === "date") return "date"
  if (qType === "address") return "address"
  if (qType === "fileUpload") return "file"
  if (qType === "signature") return "signature"

  if (qFormat === "email" || qLabel.includes("email")) return "email"
  if (qFormat === "tel" || qLabel.includes("phone")) return "phone"
  if (qFormat === "url" || qLabel.includes("website")) return "url"
  if (qFormat === "number" || qLabel.includes("age") || qLabel.includes("year"))
    return "number"
  if (qFormat === "textarea") return "paragraph"

  if (qLabel.includes("name")) return "name"
  if (qLabel.includes("country")) return "country"
  if (qLabel.includes("city")) return "city"
  if (qLabel.includes("feedback") || qLabel.includes("comment"))
    return "feedback"

  return "text"
}
