"use client";
import * as React from "react";
import type { IntentResult } from "@/headless/ai/input-intent";

export type TypedIntentDebugCardProps = {
  show: boolean;
  currentQuestionId: string | null;
  expectedFormat: string | null;
  detection: IntentResult;
  isIntentMatch: boolean;
  isHighConfidenceInvalid: boolean;
  showValidation: boolean;
  threshold: number;
};

export function TypedIntentDebugCard({
  show,
  currentQuestionId,
  expectedFormat,
  detection,
  isIntentMatch,
  isHighConfidenceInvalid,
  showValidation,
  threshold,
}: TypedIntentDebugCardProps) {
  if (!show) return null;
  return (
    <div className="mt-2 mb-2 rounded border bg-muted/30 p-2 text-xs">
      <div className="font-medium">Debug — Typed Intent</div>
      <div className="mt-1 grid grid-cols-1 gap-1 sm:grid-cols-3">
        <div>
          <span className="text-muted-foreground">qId:</span>{" "}
          <code>{currentQuestionId ?? "(none)"}</code>
        </div>
        <div>
          <span className="text-muted-foreground">expected format:</span>{" "}
          <code>{expectedFormat ?? "(none)"}</code>
        </div>
        <div>
          <span className="text-muted-foreground">intent:</span>{" "}
          <code>{detection.intent ?? "(none)"}</code>
        </div>
        <div>
          <span className="text-muted-foreground">confidence:</span>{" "}
          <code>
            {Number.isFinite(detection.confidence)
              ? detection.confidence.toFixed(2)
              : "-"}{" "}
            ≥ {threshold} → {detection.confidence >= threshold ? "yes" : "no"}
          </code>
        </div>
        <div>
          <span className="text-muted-foreground">valid:</span>{" "}
          <code>
            {detection.valid === true
              ? "true"
              : detection.valid === false
                ? "false"
                : "null"}
          </code>
        </div>
        <div>
          <span className="text-muted-foreground">match expected:</span>{" "}
          <code>{isIntentMatch ? "yes" : "no"}</code>
        </div>
        {detection.intent === "tel" && (
          <div className="sm:col-span-3">
            <span className="text-muted-foreground">tel country/dial:</span>{" "}
            <code>
              {(detection.country ?? "-").toString()} /{" "}
              {(detection.dialCode ?? "-").toString()}
            </code>
          </div>
        )}
        <div className="sm:col-span-3">
          <span className="text-muted-foreground">
            blocking (high‑conf invalid):
          </span>{" "}
          <code>{isHighConfidenceInvalid ? "yes" : "no"}</code>
          <span className="ml-2 text-muted-foreground">
            showValidation:
          </span>{" "}
          <code>{showValidation ? "true" : "false"}</code>
        </div>
      </div>
    </div>
  );
}
