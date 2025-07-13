"use client";

import { useEffect, useCallback } from "react";
import { Question } from "@formlink/schema";
import { useTypeFormDropdown } from "@formlink/ui";

interface UseTypeFormKeyboardProps {
  currentQuestion: Question | null;
  onAnswer: (questionId: string, value: any, questionType: Question["questionType"]) => void;
  onNext: () => void;
  onPrevious?: () => void;
  showHelp?: () => void;
  getCurrentResponse?: (questionId: string) => any;
}

export function useTypeFormKeyboard({
  currentQuestion,
  onAnswer,
  onNext,
  onPrevious,
  showHelp,
  getCurrentResponse,
}: UseTypeFormKeyboardProps) {
  const { isDropdownOpen } = useTypeFormDropdown();
  const handleKeyPress = useCallback((event: KeyboardEvent) => {
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
    if (event.key === "Enter" && (event.shiftKey || event.ctrlKey || event.altKey || event.metaKey)) {
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
  }, [currentQuestion, onAnswer, onNext, onPrevious, showHelp, getCurrentResponse, isDropdownOpen]);

  const handleScaleSelection = (num: number) => {
    if (!currentQuestion) return;

    if (currentQuestion.questionType === "rating") {
      const config = (currentQuestion as any).ratingConfig;
      if (config && num >= config.min && num <= config.max) {
        onAnswer(currentQuestion.id, num, currentQuestion.questionType);
      }
    } else if (currentQuestion.questionType === "linearScale") {
      const config = (currentQuestion as any).linearScaleConfig;
      if (config && num >= config.start && num <= config.end) {
        onAnswer(currentQuestion.id, num, currentQuestion.questionType);
      }
    }
  };

  const handleChoiceSelection = (letter: string) => {
    if (!currentQuestion) return;

    const options = (currentQuestion as any).options;
    if (!options) return;

    const index = letter.charCodeAt(0) - "A".charCodeAt(0);
    if (index >= 0 && index < options.length) {
      const selectedOption = options[index];
      
      if (currentQuestion.questionType === "singleChoice") {
        onAnswer(currentQuestion.id, selectedOption.value, currentQuestion.questionType);
      } else if (currentQuestion.questionType === "multipleChoice") {
        // For multiple choice, toggle the selection
        const currentResponse = getCurrentResponse ? getCurrentResponse(currentQuestion.id) : [];
        const currentArray = Array.isArray(currentResponse) ? currentResponse : [];
        
        const newValue = currentArray.includes(selectedOption.value)
          ? currentArray.filter(v => v !== selectedOption.value)
          : [...currentArray, selectedOption.value];
        
        onAnswer(currentQuestion.id, newValue, currentQuestion.questionType);
      }
    }
  };

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