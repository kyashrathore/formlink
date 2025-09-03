"use client";

import React from "react";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/useIsMobile";

interface TypeFormLayoutProps {
  children: React.ReactNode;
  className?: string;
}

export default function TypeFormLayout({
  children,
  className,
}: TypeFormLayoutProps) {
  const isMobile = useIsMobile();

  return (
    <div
      className={cn(
        "h-dvh overflow-hidden bg-background",
        "flex flex-col",
        className,
      )}
      style={{
        paddingBottom: isMobile
          ? "calc(80px + env(safe-area-inset-bottom))"
          : undefined,
      }}
    >
      {/* Main content area */}
      <main
        className={cn(
          "flex-1 flex items-center justify-center px-4 py-8",
          "overflow-y-auto overscroll-contain",
          // Add bottom padding for navigation + safe area on mobile
          // Add inline-end padding on desktop to avoid corner arrow overlap
          isMobile ? "pb-24" : "pr-24",
        )}
      >
        <div className="w-full max-w-4xl h-full flex flex-col justify-center">
          {children}
        </div>
      </main>
    </div>
  );
}
