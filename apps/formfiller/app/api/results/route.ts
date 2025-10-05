import { NextRequest, NextResponse } from "next/server";
import jsonata from "jsonata";
import { calcScore } from "@/lib/scoring/calcScore";
import { Form } from "@formlink/schema";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { generateText } from "ai";
import { loadPrompt } from "@formlink/prompts";

export async function POST(req: NextRequest) {
  try {
    const { form, responses } = (await req.json()) as {
      form: Form;
      responses: Record<string, unknown>;
    };

    if (!form || !responses) {
      return NextResponse.json(
        { error: "Missing form or responses" },
        { status: 400 },
      );
    }

    // Compute any additional fields via JSONata (if present)
    const computed: Record<string, unknown> = {};
    const spec = (form.settings as any)?.additionalFields
      ?.computedFromResponses;
    if (Array.isArray(spec)) {
      for (const item of spec) {
        try {
          const expr = jsonata(String(item.jsonata));
          computed[item.field_id] = await expr.evaluate(responses);
        } catch {
          computed[item.field_id] = null;
        }
      }
    }

    // Basic scoring summary and intent
    const score = calcScore(form, responses as any);
    const rpgpRaw = (form.settings as any)?.resultPageGenerationPrompt;
    const resultPageGenerationPrompt =
      typeof rpgpRaw === "string" ? rpgpRaw : undefined;

    // If no provider, fall back to deterministic markdown (existing behavior)
    const apiKey = process.env.OPENROUTER_API_KEY || "";
    if (!apiKey) {
      const lines: string[] = [];
      lines.push(`# Submission Summary`);
      if (resultPageGenerationPrompt) {
        lines.push(`> Instruction: ${resultPageGenerationPrompt}`);
      }
      if (score.possible > 0) {
        lines.push("\n## Score");
        lines.push(`- Total: ${score.total} / ${score.possible}`);
        lines.push(`- Percentage: ${Math.round(score.percentage)}%`);
      }
      if (Object.keys(computed).length > 0) {
        lines.push("\n## Computed Values");
        for (const [k, v] of Object.entries(computed)) {
          lines.push(
            `- ${k}: ${typeof v === "object" ? JSON.stringify(v) : String(v)}`,
          );
        }
      }
      lines.push(
        "\n> Configure OPENROUTER_API_KEY to enable AI-based personalized results.",
      );
      return NextResponse.json({ markdown: lines.join("\n") });
    }

    // AI path: generate Markdown summary using OpenRouter provider
    const provider = createOpenRouter({ apiKey });
    const model = provider("google/gemini-2.5-flash");

    // System prompt encodes output rules, safety, and structure.
    const system = await loadPrompt("filler/result-page-system.md", {
      include_guards: true,
    });

    const payload = {
      resultPageGenerationPrompt:
        resultPageGenerationPrompt ||
        "Summarize this submission and offer next steps.",
      form: {
        title: form.title,
        description: form.description || "",
      },
      questions: form.questions.map((q: any) => ({
        id: q.id,
        title: q.title,
        type: q.type?.name,
      })),
      responses,
      computed,
      score: {
        total: score.total,
        possible: score.possible,
        percentage: Math.round(score.percentage),
      },
      journeyScript:
        typeof (form.settings as any)?.journeyScript === "string"
          ? (form.settings as any)?.journeyScript
          : undefined,
    };

    const userPrompt = JSON.stringify(payload);
    const { text } = await generateText({ model, system, prompt: userPrompt });
    const markdown = typeof text === "string" && text.trim() ? text : null;
    return NextResponse.json({ markdown });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal error" },
      { status: 500 },
    );
  }
}
