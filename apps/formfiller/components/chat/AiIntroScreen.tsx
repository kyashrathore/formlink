"use client";

import React from "react";
import { Form } from "@formlink/schema";
import { FormModeProvider } from "@/contexts/FormModeContext";
import { IntroScreen } from "@/components/shared/IntroScreen";

type AiIntroScreenProps = {
  formSchema: Form;
  onStart: () => void;
};

export function AiIntroScreen({ formSchema, onStart }: AiIntroScreenProps) {
  return (
    <FormModeProvider
      defaultMode="ai"
      formSettings={{ defaultMode: "ai" }}
      urlSearchParams={{}}
    >
      <IntroScreen formSchema={formSchema} onStart={onStart} />
    </FormModeProvider>
  );
}

export default AiIntroScreen;
