"use client";
import * as React from "react";
import { useIsMobile } from "../hooks/use-mobile";

export function TypeFormLayout({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const isMobile = useIsMobile();
  const PROGRESS_PX = 4; // matches h-1 in progress bar
  const NAV_PX = 80; // mobile nav bar height target
  return (
    <div
      className={[
        "h-dvh overflow-hidden bg-background",
        "flex flex-col",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      style={{
        paddingBottom: isMobile
          ? "calc(80px + env(safe-area-inset-bottom))"
          : undefined,
      }}
    >
      <main
        className={[
          "relative flex-1 flex items-center justify-center px-4 py-8",
          "overflow-y-auto overscroll-contain",
          isMobile ? "pb-24" : "pr-24",
        ].join(" ")}
        style={{
          minHeight: `calc(100dvh - ${PROGRESS_PX}px - ${isMobile ? NAV_PX : 0}px)`,
        }}
      >
        <div className="w-full max-w-2xl h-full flex flex-col justify-center">
          {children}
        </div>
      </main>
    </div>
  );
}
