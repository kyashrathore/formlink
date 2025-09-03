"use client";

import React, { createContext, useContext, useState, ReactNode } from "react";

interface TypeFormOverlayContextType {
  isOverlayOpen: boolean;
  setOverlayOpen: (open: boolean) => void;
}

const TypeFormOverlayContext = createContext<
  TypeFormOverlayContextType | undefined
>(undefined);

export function TypeFormOverlayProvider({ children }: { children: ReactNode }) {
  const [isOverlayOpen, setOverlayOpen] = useState(false);

  return (
    <TypeFormOverlayContext.Provider value={{ isOverlayOpen, setOverlayOpen }}>
      {children}
    </TypeFormOverlayContext.Provider>
  );
}

export function useTypeFormOverlay() {
  const context = useContext(TypeFormOverlayContext);
  if (!context) {
    // Return a default value if not in provider
    return { isOverlayOpen: false, setOverlayOpen: () => {} };
  }
  return context;
}
