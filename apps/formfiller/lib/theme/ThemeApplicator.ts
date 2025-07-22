/**
 * Theme application system for FormFiller preview
 * Applies shadcn/ui CSS variables directly from tweakcn.com
 */

import { CSSVariableParser, type CSSParseResult } from "./CSSVariableParser";

export interface ShadcnVariableResult {
  success: boolean;
  error?: string;
  appliedRootVariables: string[];
  appliedDarkVariables: string[];
  warnings: string[];
}

export class ThemeApplicator {
  /**
   * Remove all applied theme properties
   */
  clearTheme(): void {
    const root = document.documentElement;
    this.clearShadcnVariables(root);
  }

  /**
   * Apply shadcn/ui CSS variables directly from tweakcn.com CSS
   * This bypasses the FormJunctionTheme system and applies raw CSS variables
   */
  applyShadcnVariables(cssText: string): ShadcnVariableResult {
    const result: ShadcnVariableResult = {
      success: false,
      appliedRootVariables: [],
      appliedDarkVariables: [],
      warnings: [],
    };

    try {
      // Parse CSS text to extract variables
      const parseResult: CSSParseResult = CSSVariableParser.parseCSS(cssText);

      if (!parseResult.success) {
        result.error = parseResult.error;
        result.warnings = parseResult.warnings || [];
        return result;
      }

      if (!parseResult.variables) {
        result.error = "No variables parsed from CSS";
        return result;
      }

      const root = document.documentElement;

      // Clear existing shadcn variables first
      this.clearShadcnVariables(root);

      // Apply :root variables
      Object.entries(parseResult.variables.root).forEach(([name, value]) => {
        root.style.setProperty(name, value);
        result.appliedRootVariables.push(name);
      });

      // Apply .dark variables by adding them to the root with [data-theme="dark"] scope
      // We'll apply them as CSS-in-JS since we can't add CSS rules directly
      const darkVariables = parseResult.variables.dark;
      if (Object.keys(darkVariables).length > 0) {
        this.applyDarkModeVariables(darkVariables, result);
      }

      // Set metadata to track what was applied
      root.setAttribute("data-shadcn-theme-applied", "true");
      root.setAttribute("data-shadcn-timestamp", Date.now().toString());

      // Add warnings from parser
      result.warnings = parseResult.warnings || [];

      result.success = true;
    } catch (error) {
      result.success = false;
      result.error =
        error instanceof Error
          ? error.message
          : "Unknown error applying shadcn variables";
      console.error("Shadcn variable application failed:", error);
    }

    return result;
  }

  /**
   * Apply dark mode variables by creating a CSS rule for dark mode
   */
  private applyDarkModeVariables(
    darkVariables: Record<string, string>,
    result: ShadcnVariableResult,
  ): void {
    // Check if we already have a dark mode style element
    let darkStyleElement = document.getElementById(
      "shadcn-dark-variables",
    ) as HTMLStyleElement;

    if (!darkStyleElement) {
      darkStyleElement = document.createElement("style");
      darkStyleElement.id = "shadcn-dark-variables";
      document.head.appendChild(darkStyleElement);
    }

    // Build CSS rule for dark mode
    const darkCSSRules: string[] = [];

    // Support multiple dark mode strategies
    const darkSelectors = [
      ".dark",
      '[data-theme="dark"]',
      ":root.dark",
      "html.dark",
      "body.dark",
    ];

    darkSelectors.forEach((selector) => {
      const cssVars = Object.entries(darkVariables)
        .map(([name, value]) => `  ${name}: ${value};`)
        .join("\n");

      darkCSSRules.push(`${selector} {\n${cssVars}\n}`);
    });

    // Set the CSS content
    darkStyleElement.textContent = darkCSSRules.join("\n\n");

    // Track applied dark variables
    result.appliedDarkVariables = Object.keys(darkVariables);
  }

  /**
   * Clear previously applied shadcn variables
   */
  private clearShadcnVariables(root: HTMLElement): void {
    // List of common shadcn variables to remove
    const shadcnVariables = [
      "--background",
      "--foreground",
      "--card",
      "--card-foreground",
      "--popover",
      "--popover-foreground",
      "--primary",
      "--primary-foreground",
      "--secondary",
      "--secondary-foreground",
      "--muted",
      "--muted-foreground",
      "--accent",
      "--accent-foreground",
      "--destructive",
      "--destructive-foreground",
      "--border",
      "--input",
      "--ring",
      "--chart-1",
      "--chart-2",
      "--chart-3",
      "--chart-4",
      "--chart-5",
      "--sidebar",
      "--sidebar-foreground",
      "--sidebar-primary",
      "--sidebar-primary-foreground",
      "--sidebar-accent",
      "--sidebar-accent-foreground",
      "--sidebar-border",
      "--sidebar-ring",
      "--font-sans",
      "--font-serif",
      "--font-mono",
      "--radius",
      "--shadow-2xs",
      "--shadow-xs",
      "--shadow-sm",
      "--shadow",
      "--shadow-md",
      "--shadow-lg",
      "--shadow-xl",
      "--shadow-2xl",
      "--tracking-normal",
      "--spacing",
    ];

    // Remove each variable
    shadcnVariables.forEach((variable) => {
      root.style.removeProperty(variable);
    });

    // Remove dark mode style element
    const darkStyleElement = document.getElementById("shadcn-dark-variables");
    if (darkStyleElement) {
      darkStyleElement.remove();
    }

    // Remove metadata
    root.removeAttribute("data-shadcn-theme-applied");
    root.removeAttribute("data-shadcn-timestamp");
  }

  /**
   * Get information about currently applied shadcn variables
   */
  getShadcnThemeInfo(): {
    isApplied: boolean;
    timestamp?: number;
    appliedVariables: string[];
  } {
    const root = document.documentElement;
    const isApplied = root.getAttribute("data-shadcn-theme-applied") === "true";
    const timestamp = root.getAttribute("data-shadcn-timestamp");

    // Get currently applied shadcn variables
    const computedStyles = getComputedStyle(root);
    const appliedVariables: string[] = [];

    // Common shadcn variables to check
    const checkVariables = [
      "--background",
      "--foreground",
      "--primary",
      "--secondary",
      "--muted",
      "--accent",
      "--border",
      "--input",
      "--ring",
    ];

    checkVariables.forEach((variable) => {
      const value = computedStyles.getPropertyValue(variable);
      if (value && value.trim()) {
        appliedVariables.push(variable);
      }
    });

    return {
      isApplied,
      timestamp: timestamp ? parseInt(timestamp) : undefined,
      appliedVariables,
    };
  }
}
