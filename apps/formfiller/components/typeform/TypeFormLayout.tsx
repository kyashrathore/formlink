"use client";

import React from "react";
import { cn } from "@/lib/utils";

interface TypeFormLayoutProps {
  children: React.ReactNode;
  className?: string;
}

export default function TypeFormLayout({ children, className }: TypeFormLayoutProps) {
  return (
    <div className={cn(
      "h-screen overflow-hidden bg-background",
      "flex flex-col",
      className
    )}>
      {/* Main content area */}
      <main className="flex-1 flex items-center justify-center px-4 py-8">
        <div className="w-full max-w-4xl h-full flex flex-col justify-center">
          {children}
        </div>
      </main>
    </div>
  );
}