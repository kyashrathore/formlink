"use client";

import React, { ReactNode } from "react";

interface TypeformTemplateProps {
  title: string;
  description?: string;
  children: ReactNode;
}

export function TypeformTemplate({
  title,
  description,
  children,
}: TypeformTemplateProps) {
  return (
    <div className="w-full border rounded-lg p-8 bg-background">
      <div className="max-w-3xl mx-auto">
        <header className="mb-8">
          <h2 className="text-3xl font-semibold tracking-tight">{title}</h2>
          {description && (
            <p className="text-muted-foreground mt-2 text-base">
              {description}
            </p>
          )}
        </header>
        <div>{children}</div>
      </div>
    </div>
  );
}

export default TypeformTemplate;
