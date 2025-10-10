"use client";

import React from "react";
import { Form } from "@formlink/schema";
import { FormModeProvider, IntroScreen } from "@formlink/ui";

type AiIntroScreenProps = {
  formSchema: Form;
  onStart: () => void;
};

export function AiIntroScreen({ formSchema, onStart }: AiIntroScreenProps) {
  return (
    <FormModeProvider
      defaultMode="chat"
      formSettings={{ defaultMode: "chat" }}
      urlSearchParams={{}}
    >
      <IntroScreen formSchema={formSchema} onStart={onStart} />
    </FormModeProvider>
  );
}

export default AiIntroScreen;
