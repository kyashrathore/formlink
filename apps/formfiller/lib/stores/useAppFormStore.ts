"use client";

import { create } from "zustand";
import { v4 as uuidv4 } from "uuid";
import { apiConfig, apiServices } from "../api-config";

// Helper function to get all questions from the form schema
const getAllQuestions = (formSchema: any): any[] => {
  return formSchema.questions || [];
};

// App-level store - handles all business logic and API calls
export interface AppFormState {
  formSchema: any | null;
  formId: string | undefined;
  submissionId: string | undefined;
  questions: any[];
  questionResponses: Record<string, any>; // Stores answers: { questionId: answer }
  isCompleted: boolean;
}

export interface AppFormActions {
  // Core business logic
  initialize: (schema: any, id?: string) => Promise<void>;
  restart: () => Promise<void>;
  
  // Question response management
  setQuestionResponse: (questionId: string, value: any) => void;
  handleSingleChoiceChange: (questionId: string, value: string) => void;
  handleMultipleChoiceChange: (questionId: string, value: string, checked: boolean) => void;
  handleTextChange: (questionId: string, value: string) => void;
  
  // Navigation logic
  shouldShowQuestion: (question: any) => boolean;
  getNextValidQuestionIndex: (currentIndex: number) => number | null;
  markAsCompleted: () => void;
  
  // File upload business logic
  handleFileUpload: (questionId: string, file: File) => Promise<string | null>;
  
  // Utilities
  getCurrentQuestion: (activeIndex: number) => any | null;
  getProgress: (activeIndex: number) => number;
  reset: () => void;
}

const initialAppState: AppFormState = {
  formSchema: null,
  formId: undefined,
  submissionId: undefined,
  questions: [],
  questionResponses: {},
  isCompleted: false,
};

export const useAppFormStore = create<AppFormState & AppFormActions>()((set, get) => ({
  ...initialAppState,

  initialize: async (schema, id) => {
    const submissionId = uuidv4();
    const allQuestions = getAllQuestions(schema);
    
    
    set({
      formSchema: schema,
      formId: id,
      submissionId: submissionId,
      questions: allQuestions,
      questionResponses: {},
      isCompleted: false,
    });

    // Create the submission record in the database
    if (id) {
      try {
        await apiServices.saveAnswers(id, {
          submissionId: submissionId,
          answers: [],
          formVersionId: schema.version_id,
          isTestSubmission: false,
          status: "in_progress",
        });
      } catch (error) {
        console.error("Failed to create initial submission record:", error);
      }
    }
  },

  restart: async () => {
    const currentState = get();
    const { formSchema, formId } = currentState;
    
    
    // Reset state
    set({
      ...initialAppState,
    });
    
    // Re-initialize with fresh data
    if (formSchema && formId) {
      await get().initialize(formSchema, formId);
    }
  },

  setQuestionResponse: (questionId: string, value: any) => {
    set((state) => ({
      questionResponses: {
        ...state.questionResponses,
        [questionId]: value,
      },
    }));
  },

  handleSingleChoiceChange: (questionId, value) => {
    get().setQuestionResponse(questionId, value);
  },

  handleMultipleChoiceChange: (questionId, value, checked) => {
    const currentResponse = get().questionResponses[questionId] || [];
    const responseArray = Array.isArray(currentResponse) ? currentResponse as string[] : [];
    const newResponse = checked
      ? [...responseArray, value]
      : responseArray.filter((item: string) => item !== value);
    
    get().setQuestionResponse(questionId, newResponse);
  },

  handleTextChange: (questionId, value) => {
    get().setQuestionResponse(questionId, value);
  },

  shouldShowQuestion: (question) => {
    // Basic implementation: always show.
    // TODO: Implement actual conditional logic based on question.conditionalLogic
    // and current questionResponses
    return true;
  },

  getNextValidQuestionIndex: (currentIndex: number) => {
    const { questions } = get();
    let nextIndex = currentIndex + 1;

    while (nextIndex < questions.length) {
      if (get().shouldShowQuestion(questions[nextIndex])) {
        return nextIndex;
      }
      nextIndex++;
    }

    return null; // No more valid questions
  },

  markAsCompleted: () => {
    set({ isCompleted: true });
  },

  handleFileUpload: async (questionId: string, file: File): Promise<string | null> => {
    const { formId, submissionId } = get();
    if (!formId || !submissionId) {
      console.error("formId or submissionId not available for upload.");
      return null;
    }

    const formData = new FormData();
    formData.append("file", file);
    formData.append("formId", formId);
    formData.append("submissionId", submissionId);
    formData.append("questionId", questionId);

    try {
      const result = await apiServices.uploadFile(formData);
      
      // Save the returned URL as the answer
      get().setQuestionResponse(questionId, result.url);
      
      return result.url;

    } catch (error) {
      console.error("Error uploading file:", error);
      return null;
    }
  },

  getCurrentQuestion: (activeIndex: number) => {
    const { questions } = get();
    return activeIndex >= 0 && activeIndex < questions.length 
      ? questions[activeIndex] 
      : null;
  },

  getProgress: (activeIndex: number) => {
    const { questions } = get();
    return activeIndex >= 0 
      ? ((activeIndex + 1) / questions.length) * 100 
      : 0;
  },

  reset: () => {
    set(initialAppState);
  },
}));