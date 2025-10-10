/**
 * Theme application system for FormFiller preview
 * Applies shadcn/ui CSS variables directly from tweakcn.com
 */

import {
  CSSVariableParser,
  type CSSParseResult,
  type ParsedCSSVariables,
} from "./CSSVariableParser";

export interface ShadcnVariableResult {
  success: boolean;
  error?: string;
  appliedRootVariables: string[];
  appliedDarkVariables: string[];
  warnings: string[];
}

export class ThemeApplicator {
  private lastParsed: ParsedCSSVariables | null = null;
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

      // Apply :root variables via a dedicated <style> tag (not inline),
      // so that .dark class rules can correctly override on toggle.
      this.applyRootVariables(parseResult.variables.root, result);

      // Apply .dark variables by adding them to the root with [data-theme="dark"] scope
      // We'll apply them as CSS-in-JS since we can't add CSS rules directly
      const darkVariables = parseResult.variables.dark;
      if (Object.keys(darkVariables).length > 0) {
        this.applyDarkModeVariables(darkVariables, result);
      }

      // Remember parsed variables for inline sync on mode toggle
      this.lastParsed = parseResult.variables;

      // Immediately sync inline custom properties for current mode to avoid stale values
      this.syncInlineForCurrentMode();

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
    }

    return result;
  }

  /**
   * Recompute inline CSS variables based on current mode (light/dark).
   * Ensures instant correctness after toggling classes without reload.
   */
  syncInlineForCurrentMode(): void {
    if (!this.lastParsed) return;
    const root = document.documentElement;
    let isDark = root.classList.contains("dark");
    if (!isDark && !root.classList.contains("light")) {
      try {
        isDark =
          typeof window !== "undefined" &&
          !!window.matchMedia &&
          window.matchMedia("(prefers-color-scheme: dark)").matches;
      } catch {}
    }

    // Merge root with dark overrides when dark
    const merged: Record<string, string> = { ...this.lastParsed.root };
    if (isDark) {
      for (const [k, v] of Object.entries(this.lastParsed.dark)) merged[k] = v;
    }

    // Apply inline style overrides for all known vars
    for (const [k, v] of Object.entries(merged)) {
      root.style.setProperty(k, v);
    }

    // Clear any vars that exist only in the opposite mode to avoid residue
    const toMaybeClear = isDark
      ? Object.keys(this.lastParsed.root)
      : Object.keys(this.lastParsed.dark);
    for (const k of toMaybeClear) {
      if (!(k in merged)) root.style.removeProperty(k);
    }
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
   * Apply light (:root) variables using a style element
   */
  private applyRootVariables(
    rootVariables: Record<string, string>,
    result: ShadcnVariableResult,
  ): void {
    let rootStyleElement = document.getElementById(
      "shadcn-root-variables",
    ) as HTMLStyleElement;

    if (!rootStyleElement) {
      rootStyleElement = document.createElement("style");
      rootStyleElement.id = "shadcn-root-variables";
      document.head.appendChild(rootStyleElement);
    }

    const cssVars = Object.entries(rootVariables)
      .map(([name, value]) => `  ${name}: ${value};`)
      .join("\n");

    rootStyleElement.textContent = `:root {\n${cssVars}\n}`;
    result.appliedRootVariables = Object.keys(rootVariables);
  }

  /**
   * Clear previously applied shadcn variables
   */
  private clearShadcnVariables(root: HTMLElement): void {
    // Remove style elements we inject for root/dark variables
    const rootStyleElement = document.getElementById("shadcn-root-variables");
    if (rootStyleElement) {
      rootStyleElement.remove();
    }
    const darkStyleElement = document.getElementById("shadcn-dark-variables");
    if (darkStyleElement) {
      darkStyleElement.remove();
    }

    // Clear inline variable overrides from previous application
    if (this.lastParsed) {
      const allKeys = new Set([
        ...Object.keys(this.lastParsed.root),
        ...Object.keys(this.lastParsed.dark),
      ]);
      for (const k of allKeys) root.style.removeProperty(k);
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
