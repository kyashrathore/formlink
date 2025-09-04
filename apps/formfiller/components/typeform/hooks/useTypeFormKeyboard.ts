"use client";

import { useCallback, useEffect } from "react";
import {
  UseTypeFormKeyboardProps,
  safeGetRatingConfig,
  safeGetLinearScaleConfig,
  safeGetOptions,
} from "../../../lib/types";
import { getQuestionTypeName } from "@formlink/schema";

export function useTypeFormKeyboard({
  currentQuestion,
  onAnswer,
  onNext,
  onPrevious,
  showHelp,
  getCurrentResponse,
  isCurrentQuestionValid,
}: UseTypeFormKeyboardProps) {
  const isOverlayOpen = false;

  const handleScaleSelection = useCallback(
    (num: number) => {
      if (!currentQuestion) return;

      if (currentQuestion.type.name === "rating") {
        const config = safeGetRatingConfig(currentQuestion);
        if (num >= config.min && num <= config.max) {
          onAnswer(
            currentQuestion.id,
            num,
            getQuestionTypeName(currentQuestion),
          );
        }
      } else if (currentQuestion.type.name === "linearScale") {
        const config = safeGetLinearScaleConfig(currentQuestion);
        if (num >= config.start && num <= config.end) {
          onAnswer(
            currentQuestion.id,
            num,
            getQuestionTypeName(currentQuestion),
          );
        }
      }
    },
    [currentQuestion, onAnswer],
  );

  const handleChoiceSelection = useCallback(
    (letter: string) => {
      if (!currentQuestion) return;

      if (
        currentQuestion.type.name !== "singleChoice" &&
        currentQuestion.type.name !== "multipleChoice" &&
        currentQuestion.type.name !== "ranking"
      ) {
        return;
      }

      const options = safeGetOptions(currentQuestion);
      if (!options) return;

      const index = letter.charCodeAt(0) - "A".charCodeAt(0);
      if (index >= 0 && index < options.length) {
        const selectedOption = options[index];
        if (!selectedOption) return;

        if (currentQuestion.type.name === "singleChoice") {
          onAnswer(
            currentQuestion.id,
            selectedOption.value,
            getQuestionTypeName(currentQuestion),
          );
        } else if (currentQuestion.type.name === "multipleChoice") {
          const currentResponse = getCurrentResponse
            ? getCurrentResponse(currentQuestion.id)
            : [];
          const currentArray = Array.isArray(currentResponse)
            ? (currentResponse as string[])
            : [];

          const newValue = currentArray.includes(selectedOption.value)
            ? currentArray.filter((v) => v !== selectedOption.value)
            : [...currentArray, selectedOption.value];

          onAnswer(
            currentQuestion.id,
            newValue,
            getQuestionTypeName(currentQuestion),
          );
        }
      }
    },
    [currentQuestion, onAnswer, getCurrentResponse],
  );

  const handleKeyPress = useCallback(
    (event: KeyboardEvent) => {
      if (isOverlayOpen) return; // Master switch

      const target = event.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.contentEditable === "true"
      ) {
        return;
      }

      if (
        event.key === "Enter" &&
        (event.shiftKey || event.ctrlKey || event.altKey || event.metaKey)
      ) {
        return;
      }

      if (!currentQuestion) return;

      switch (event.key) {
        case "Enter":
          if (isCurrentQuestionValid) {
            event.preventDefault();
            onNext();
          }
          break;

        // Arrow keys intentionally unbound for now; see LLD.

        case "?":
          event.preventDefault();
          if (showHelp) showHelp();
          break;

        default:
          if (
            currentQuestion.type.name === "rating" ||
            currentQuestion.type.name === "linearScale"
          ) {
            const num = parseInt(event.key);
            if (!isNaN(num) && num >= 0 && num <= 9) {
              event.preventDefault();
              handleScaleSelection(num);
            }
          }

          if (
            currentQuestion.type.name === "singleChoice" ||
            currentQuestion.type.name === "multipleChoice"
          ) {
            const letter = event.key.toUpperCase();
            if (letter.length === 1 && letter >= "A" && letter <= "Z") {
              event.preventDefault();
              handleChoiceSelection(letter);
            }
          }
          break;
      }
    },
    [
      currentQuestion,
      onNext,
      showHelp,
      isOverlayOpen,
      handleChoiceSelection,
      handleScaleSelection,
      isCurrentQuestionValid,
    ],
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyPress);
    return () => {
      window.removeEventListener("keydown", handleKeyPress);
    };
  }, [handleKeyPress]);

  return {
    handleKeyPress,
  };
}
