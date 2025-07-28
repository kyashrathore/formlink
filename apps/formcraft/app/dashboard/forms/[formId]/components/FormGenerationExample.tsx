/**
 * Example of using the new form generation architecture
 */

"use client"

import {
  AsyncCollectionSection,
  AsyncSection,
} from "@/app/components/AsyncSection"
import { useFormGeneration } from "@/app/hooks/useFormGenerationSSE"
import { Badge, Button, Card } from "@formlink/ui"
import { AlertCircle, CheckCircle, Loader2 } from "lucide-react"
import React from "react"
import {
  JourneyShimmer,
  MetadataShimmer,
  QuestionsShimmer,
} from "./form/shimmers/FormShimmers"

interface FormGenerationExampleProps {
  formId: string
}

export function FormGenerationExample({ formId }: FormGenerationExampleProps) {
  const {
    metadata,
    journey,
    questions,
    overallStatus,
    retrySection,
    connection,
    isConnected,
  } = useFormGeneration(formId)

  return (
    <div className="space-y-6">
      {/* Connection Status */}
      <Card className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold">Form Generation Status</h3>
            <Badge variant={isConnected ? "success" : "secondary"}>
              {isConnected ? "Connected" : "Disconnected"}
            </Badge>
          </div>

          {!isConnected && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => connection.reconnect()}
            >
              Reconnect
            </Button>
          )}
        </div>
      </Card>

      {/* Metadata Section */}
      <AsyncSection
        data={metadata}
        shimmer={MetadataShimmer}
        content={({ data }) => (
          <Card className="p-6">
            <div className="mb-4 flex items-start justify-between">
              <h3 className="text-lg font-semibold">Form Details</h3>
              <CheckCircle className="h-5 w-5 text-green-500" />
            </div>
            <div className="space-y-2">
              <div>
                <label className="text-muted-foreground text-sm">Title</label>
                <p className="font-medium">{data.title}</p>
              </div>
              {data.description && (
                <div>
                  <label className="text-muted-foreground text-sm">
                    Description
                  </label>
                  <p className="text-sm">{data.description}</p>
                </div>
              )}
            </div>
          </Card>
        )}
        errorFallback={({ error, onRetry, canRetry }) => (
          <Card className="border-destructive p-6">
            <div className="mb-4 flex items-center gap-3">
              <AlertCircle className="text-destructive h-5 w-5" />
              <h3 className="font-semibold">Failed to load form details</h3>
            </div>
            <p className="text-muted-foreground mb-4 text-sm">
              {error.message}
            </p>
            {canRetry && (
              <Button size="sm" variant="outline" onClick={onRetry}>
                Try Again
              </Button>
            )}
          </Card>
        )}
        onRetry={() => retrySection("metadata")}
        ariaLabel="Form Details"
      />

      {/* Journey Section */}
      <AsyncSection
        data={journey}
        shimmer={JourneyShimmer}
        content={({ data }) => (
          <Card className="p-6">
            <div className="mb-4 flex items-start justify-between">
              <h3 className="text-lg font-semibold">Form Journey</h3>
              <CheckCircle className="h-5 w-5 text-green-500" />
            </div>
            <div className="prose prose-sm max-w-none">
              <pre className="bg-muted rounded-lg p-4 whitespace-pre-wrap">
                {data}
              </pre>
            </div>
          </Card>
        )}
        onRetry={() => retrySection("journey")}
        ariaLabel="Form Journey"
      />

      {/* Questions Section */}
      <AsyncCollectionSection
        data={questions}
        shimmer={() =>
          questions.total ? (
            <QuestionsShimmer count={questions.total} />
          ) : (
            <LoadingQuestions />
          )
        }
        content={({ items, total, generatedCount }) => (
          <Card className="p-6">
            <div className="mb-4 flex items-start justify-between">
              <div>
                <h3 className="text-lg font-semibold">Questions</h3>
                <p className="text-muted-foreground text-sm">
                  {generatedCount} of {total || "?"} generated
                </p>
              </div>
              {generatedCount === total && (
                <CheckCircle className="h-5 w-5 text-green-500" />
              )}
            </div>

            <div className="space-y-3">
              {items.map((question, index) => (
                <div key={question.id} className="rounded-lg border p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <p className="font-medium">{question.title}</p>
                      <p className="text-muted-foreground mt-1 text-sm">
                        Type: {question.type} •{" "}
                        {question.required ? "Required" : "Optional"}
                      </p>
                    </div>
                    <Badge variant="secondary">#{index + 1}</Badge>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}
        renderProgress={(current, total) => (
          <Card className="bg-primary/5 mb-4 p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-sm font-medium">
                  Generating questions...
                </span>
              </div>
              <span className="text-muted-foreground text-sm">
                {current} / {total}
              </span>
            </div>
          </Card>
        )}
        onRetry={() => retrySection("questions")}
        ariaLabel="Questions"
      />

      {/* Overall Status Summary */}
      {overallStatus === "complete" && (
        <Card className="border-green-200 bg-green-50 p-6 dark:border-green-900 dark:bg-green-950/20">
          <div className="flex items-center gap-3">
            <CheckCircle className="h-6 w-6 text-green-600" />
            <div>
              <h3 className="font-semibold text-green-900 dark:text-green-100">
                Form Generation Complete
              </h3>
              <p className="text-sm text-green-700 dark:text-green-300">
                Your form has been successfully generated with{" "}
                {questions.items.length} questions.
              </p>
            </div>
          </div>
        </Card>
      )}
    </div>
  )
}

const LoadingQuestions: React.FC = () => (
  <Card className="p-8">
    <div className="flex flex-col items-center justify-center text-center">
      <Loader2 className="text-primary mb-4 h-8 w-8 animate-spin" />
      <p className="text-muted-foreground">Preparing questions...</p>
    </div>
  </Card>
)
