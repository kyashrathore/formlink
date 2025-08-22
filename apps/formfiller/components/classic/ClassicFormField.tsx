"use client";

import type { QuestionResponse } from "@/lib/types";
import type { Question } from "@formlink/schema";
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@formlink/ui";
import QuestionInputSwitcher from "./QuestionInputSwitcher";

interface ClassicFormFieldProps {
  question: Question;
  value: QuestionResponse;
  onChange: (value: QuestionResponse) => void;
  onFileUpload?: (file: File) => Promise<string | null>;
  errors?: any;
}

export default function ClassicFormField({
  question,
  value,
  onChange,
  onFileUpload,
  errors,
}: ClassicFormFieldProps) {
  return (
    <FormField
      name={question.id}
      render={({ field }) => (
        <FormItem className="space-y-3">
          <FormLabel className="text-base font-medium">
            {question.label || question.title}
            {question.validations?.required?.value && (
              <span className="text-destructive ml-1">*</span>
            )}
          </FormLabel>

          {question.description && (
            <FormDescription className="text-sm text-muted-foreground">
              {question.description}
            </FormDescription>
          )}

          <FormControl>
            <QuestionInputSwitcher
              question={question}
              value={value}
              onChange={(newValue) => {
                onChange(newValue);
                field.onChange(newValue);
              }}
              onFileUpload={onFileUpload}
              fieldProps={{
                name: field.name,
                onBlur: field.onBlur,
                disabled: field.disabled,
              }}
            />
          </FormControl>

          <FormMessage />

          {/* Display readable validation rules */}
          {question.readableValidations &&
            question.readableValidations.length > 0 && (
              <div className="text-xs text-muted-foreground mt-2">
                {question.readableValidations.map((rule, index) => (
                  <div key={index}>{rule}</div>
                ))}
              </div>
            )}

          {/* Display readable conditional logic */}
          {question.readableConditionalLogic &&
            question.readableConditionalLogic.length > 0 && (
              <div className="text-xs text-muted-foreground mt-1 italic">
                {question.readableConditionalLogic.map((logic, index) => (
                  <div key={index}>Condition: {logic}</div>
                ))}
              </div>
            )}

          {/* Display readable config for specific question types */}
          {question.readableRatingConfig && (
            <div className="text-xs text-muted-foreground mt-1">
              {question.readableRatingConfig}
            </div>
          )}

          {question.readableLikertConfig && (
            <div className="text-xs text-muted-foreground mt-1">
              {question.readableLikertConfig}
            </div>
          )}

          {question.readableRankingConfig && (
            <div className="text-xs text-muted-foreground mt-1">
              {question.readableRankingConfig}
            </div>
          )}
        </FormItem>
      )}
    />
  );
}
