"use client";

import React, { createContext, useContext, useState, ReactNode } from "react";

interface TypeFormDropdownContextType {
  isDropdownOpen: boolean;
  setDropdownOpen: (open: boolean) => void;
}

const TypeFormDropdownContext = createContext<TypeFormDropdownContextType | undefined>(undefined);

export function TypeFormDropdownProvider({ children }: { children: ReactNode }) {
  const [isDropdownOpen, setDropdownOpen] = useState(false);

  return (
    <TypeFormDropdownContext.Provider value={{ isDropdownOpen, setDropdownOpen }}>
      {children}
    </TypeFormDropdownContext.Provider>
  );
}

export function useTypeFormDropdown() {
  const context = useContext(TypeFormDropdownContext);
  if (!context) {
    // Return a default value if not in provider (for backwards compatibility)
    return { isDropdownOpen: false, setDropdownOpen: () => {} };
  }
  return context;
}