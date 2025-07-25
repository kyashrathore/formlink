"use client";

import { useTypeFormDropdown } from "@formlink/ui";
import { useCallback, useEffect } from "react";
import { UseTypeFormKeyboardProps } from "../../../lib/types";

// UseTypeFormKeyboardProps is now imported from types.ts

export function useTypeFormKeyboard({
  currentQuestion,
  onAnswer,
  onNext,
  onPrevious,
  showHelp,
  getCurrentResponse,
}: UseTypeFormKeyboardProps) {
  const { isDropdownOpen } = useTypeFormDropdown();

  const handleScaleSelection = useCallback(
    (num: number) => {
      if (!currentQuestion) return;

      if (currentQuestion.questionType === "rating") {
        const ratingQuestion = currentQuestion as typeof currentQuestion & {
          ratingConfig: { max: number; min?: number };
        };
        const config = ratingQuestion.ratingConfig;
        const min = config.min || 1;
        if (config && num >= min && num <= config.max) {
          onAnswer(currentQuestion.id, num, currentQuestion.questionType);
        }
      } else if (currentQuestion.questionType === "linearScale") {
        const scaleQuestion = currentQuestion as typeof currentQuestion & {
          linearScaleConfig: { start: number; end: number };
        };
        const config = scaleQuestion.linearScaleConfig;
        if (config && num >= config.start && num <= config.end) {
          onAnswer(currentQuestion.id, num, currentQuestion.questionType);
        }
      }
    },
    [currentQuestion, onAnswer],
  );

  const handleChoiceSelection = useCallback(
    (letter: string) => {
      if (!currentQuestion) return;

      // Check if question has options (choice or ranking questions)
      if (
        currentQuestion.questionType !== "singleChoice" &&
        currentQuestion.questionType !== "multipleChoice" &&
        currentQuestion.questionType !== "ranking"
      ) {
        return;
      }

      const choiceQuestion = currentQuestion as typeof currentQuestion & {
        options: Array<{ value: string; label: string }>;
      };
      const options = choiceQuestion.options;
      if (!options) return;

      const index = letter.charCodeAt(0) - "A".charCodeAt(0);
      if (index >= 0 && index < options.length) {
        const selectedOption = options[index];

        if (currentQuestion.questionType === "singleChoice") {
          onAnswer(
            currentQuestion.id,
            selectedOption.value,
            currentQuestion.questionType,
          );
        } else if (currentQuestion.questionType === "multipleChoice") {
          // For multiple choice, toggle the selection
          const currentResponse = getCurrentResponse
            ? getCurrentResponse(currentQuestion.id)
            : [];
          const currentArray = Array.isArray(currentResponse)
            ? (currentResponse as string[])
            : [];

          const newValue = currentArray.includes(selectedOption.value)
            ? currentArray.filter((v) => v !== selectedOption.value)
            : [...currentArray, selectedOption.value];

          onAnswer(currentQuestion.id, newValue, currentQuestion.questionType);
        }
      }
    },
    [currentQuestion, onAnswer, getCurrentResponse],
  );

  const handleKeyPress = useCallback(
    (event: KeyboardEvent) => {
      // Don't handle if user is typing in an input
      const target = event.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.contentEditable === "true"
      ) {
        // Allow Enter key in inputs for submission, but not if dropdown is open
        if (event.key === "Enter" && !event.shiftKey && !isDropdownOpen) {
          event.preventDefault();
          onNext();
        }
        return;
      }

      // Prevent navigation on modifier + Enter combinations
      if (
        event.key === "Enter" &&
        (event.shiftKey || event.ctrlKey || event.altKey || event.metaKey)
      ) {
        return;
      }

      if (!currentQuestion) return;

      switch (event.key) {
        case "Enter":
          // Don't navigate if dropdown is open
          if (!isDropdownOpen) {
            event.preventDefault();
            onNext();
          }
          break;

        case "ArrowUp":
        case "ArrowLeft":
          event.preventDefault();
          if (onPrevious) onPrevious();
          break;

        case "ArrowDown":
        case "ArrowRight":
          event.preventDefault();
          onNext();
          break;

        case "?":
          event.preventDefault();
          if (showHelp) showHelp();
          break;

        default:
          // Handle number keys for rating/scale questions
          if (
            currentQuestion.questionType === "rating" ||
            currentQuestion.questionType === "linearScale"
          ) {
            const num = parseInt(event.key);
            if (!isNaN(num) && num >= 0 && num <= 9) {
              event.preventDefault();
              handleScaleSelection(num);
            }
          }

          // Handle letter keys for choice questions
          if (
            currentQuestion.questionType === "singleChoice" ||
            currentQuestion.questionType === "multipleChoice"
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
      onPrevious,
      showHelp,
      isDropdownOpen,
      handleChoiceSelection,
      handleScaleSelection,
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
