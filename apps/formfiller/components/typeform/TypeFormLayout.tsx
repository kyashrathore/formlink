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
        "h-screen overflow-hidden bg-background",
        "flex flex-col",
        className,
      )}
    >
      {/* Main content area */}
      <main className={cn(
        "flex-1 flex items-center justify-center px-4 py-8",
        // Add bottom padding on mobile to account for navigation bar
        isMobile && "pb-24"
      )}>
        <div className="w-full max-w-4xl h-full flex flex-col justify-center">
          {children}
        </div>
      </main>
    </div>
  );
}
