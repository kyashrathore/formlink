/**
 * Custom hook for loading and applying themes from database
 * Used in FormPageClient to ensure themes persist on page refresh
 */

import { useEffect, useRef, useState } from "react";
import {
  ThemeApplicator,
  type ShadcnVariableResult,
} from "@/lib/theme/ThemeApplicator";
import { Form } from "@formlink/schema";
import type { FormSettings } from "@/lib/types";

interface ThemeLoaderResult {
  isLoading: boolean;
  error: string | null;
  themeApplied: boolean;
  appliedVariables: string[];
}

/**
 * Hook to load and apply saved themes from the database
 */
export function useThemeLoader(formSchema: Form): ThemeLoaderResult {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [themeApplied, setThemeApplied] = useState(false);
  const [appliedVariables, setAppliedVariables] = useState<string[]>([]);

  const themeApplicator = useRef(new ThemeApplicator());
  const hasLoadedRef = useRef(false);

  useEffect(() => {
    // Prevent double loading
    if (hasLoadedRef.current) return;
    hasLoadedRef.current = true;

    const loadAndApplyTheme = async () => {
      try {
        setIsLoading(true);
        setError(null);

        // Extract theme from form settings
        const settings = formSchema.settings as FormSettings;
        const savedTheme = settings?.theme_overrides?.shadcn_css;

        if (savedTheme && typeof savedTheme === "string") {
          // Apply the saved theme
          const result: ShadcnVariableResult =
            themeApplicator.current.applyShadcnVariables(savedTheme);

          if (result.success) {
            setThemeApplied(true);
            setAppliedVariables([
              ...result.appliedRootVariables,
              ...result.appliedDarkVariables,
            ]);

            if (result.warnings.length > 0) {
              console.warn("Theme application warnings:", result.warnings);
            }
          } else {
            console.error("Theme application failed:", result.error);
            setError(result.error || "Theme application failed");
          }
        } else {
        }
      } catch (err) {
        console.error("Error loading theme:", err);
        setError(
          err instanceof Error ? err.message : "Unknown error loading theme",
        );
      } finally {
        setIsLoading(false);
      }
    };

    // Only load if we're in the browser
    if (typeof window !== "undefined") {
      loadAndApplyTheme();
    } else {
      setIsLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Empty deps since we use hasLoadedRef to prevent re-runs

  return {
    isLoading,
    error,
    themeApplied,
    appliedVariables,
  };
}
