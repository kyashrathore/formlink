import { NextRequest, NextResponse } from "next/server";
import jsonata from "jsonata";
import { calcScore } from "@/lib/scoring/calcScore";
import { Form } from "@formlink/schema";

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

    // Basic scoring summary
    const score = calcScore(form, responses as any);

    // Use form.settings.resultPageGenerationPrompt as intent for AI
    // For now (no provider wired here), build a deterministic markdown using computed fields + score
    const prompt = (form.settings as any)?.resultPageGenerationPrompt as
      | string
      | undefined;

    const lines: string[] = [];
    lines.push(`# Submission Summary`);
    if (prompt) {
      lines.push(`> Intent: ${prompt}`);
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
      "\n> Configure an AI provider to replace this with personalized results.",
    );

    return NextResponse.json({ markdown: lines.join("\n") });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal error" },
      { status: 500 },
    );
  }
}
