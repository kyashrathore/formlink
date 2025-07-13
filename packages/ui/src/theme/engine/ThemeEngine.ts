import { FormlinkTheme, PartialTheme, ValidationResult } from "../types";
import { CSSGenerator } from "./CSSGenerator";
import { Validator } from "./Validator";

export class ThemeEngine {
  private cssGenerator: CSSGenerator;
  private validator: Validator;
  private cssVarMap = new Map<string, string>();
  private currentTheme: FormlinkTheme | null = null;

  constructor() {
    this.cssGenerator = new CSSGenerator();
    this.validator = new Validator();
  }

  /**
   * Apply a complete theme to the application
   */
  applyTheme(theme: FormlinkTheme): ValidationResult {
    // 1. Validate theme structure and accessibility
    const validationResult = this.validator.validateTheme(theme);

    if (!validationResult.valid) {
      console.error("Theme validation failed:", validationResult.errors);
      return validationResult;
    }

    if (validationResult.warnings.length > 0) {
      console.warn("Theme validation warnings:", validationResult.warnings);
    }

    // 2. Generate CSS variables
    this.cssVarMap = this.cssGenerator.generateCSSVariables(theme);

    // 3. Apply to DOM
    this.applyToDOM();

    // 4. Store current theme
    this.currentTheme = theme;

    // 5. Set mode-specific attributes
    const root = document.documentElement;
    root.setAttribute("data-theme-applied", "true");
    root.setAttribute("data-theme-mode", this.detectMode(theme));

    // 6. Apply accessibility settings
    this.applyAccessibilitySettings(theme);

    // 7. Dispatch theme change event
    this.dispatchThemeChangeEvent(theme);

    return validationResult;
  }

  /**
   * Apply a partial theme override
   */
  applyPartialTheme(partialTheme: PartialTheme): ValidationResult {
    if (!this.currentTheme) {
      return {
        valid: false,
        errors: ["No base theme applied. Apply a complete theme first."],
        warnings: [],
      };
    }

    // Merge with current theme
    const mergedTheme = this.deepMerge(
      this.currentTheme,
      partialTheme,
    ) as FormlinkTheme;

    // Apply the merged theme
    return this.applyTheme(mergedTheme);
  }

  /**
   * Get the current applied theme
   */
  getCurrentTheme(): FormlinkTheme | null {
    return this.currentTheme;
  }

  /**
   * Get a specific CSS variable value
   */
  getCSSVariable(varName: string): string | undefined {
    return this.cssVarMap.get(varName);
  }

  /**
   * Update a single CSS variable
   */
  updateCSSVariable(varName: string, value: string): void {
    this.cssVarMap.set(varName, value);
    document.documentElement.style.setProperty(varName, value);
  }

  /**
   * Reset to default theme
   */
  reset(): void {
    this.cssVarMap.clear();
    this.currentTheme = null;

    // Remove all CSS variables
    const root = document.documentElement;
    Array.from(root.style).forEach((prop) => {
      if (prop.startsWith("--fj-")) {
        root.style.removeProperty(prop);
      }
    });

    // Remove theme attributes
    root.removeAttribute("data-theme-applied");
    root.removeAttribute("data-theme-mode");
  }

  /**
   * Apply CSS variables to DOM
   */
  private applyToDOM(): void {
    const root = document.documentElement;
    this.cssVarMap.forEach((value, key) => {
      root.style.setProperty(key, value);
    });
  }

  /**
   * Apply accessibility settings
   */
  private applyAccessibilitySettings(theme: FormlinkTheme): void {
    const root = document.documentElement;
    const { accessibility } = theme;

    // Font size multiplier
    if (accessibility.fontSizeMultiplier !== 1) {
      root.style.setProperty(
        "--fj-font-size-multiplier",
        String(accessibility.fontSizeMultiplier),
      );
    }

    // Color blind mode
    if (accessibility.colorBlindMode !== "none") {
      root.setAttribute("data-color-blind-mode", accessibility.colorBlindMode);
    }

    // High contrast mode
    if (accessibility.highContrast) {
      root.setAttribute("data-high-contrast", "true");
    }

    // Reduced motion
    if (accessibility.reducedMotion.disableAnimations) {
      root.setAttribute("data-reduced-motion", "true");
    }
  }

  /**
   * Detect theme mode (light/dark)
   */
  private detectMode(theme: FormlinkTheme): "light" | "dark" {
    // Simple detection based on background luminance
    const bgColor = theme.tokens.colors.background;
    const rgb = this.hexToRgb(bgColor);
    if (!rgb) return "light";

    const luminance = (0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b) / 255;
    return luminance > 0.5 ? "light" : "dark";
  }

  /**
   * Convert hex to RGB
   */
  private hexToRgb(hex: string): { r: number; g: number; b: number } | null {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result
      ? {
          r: parseInt(result[1], 16),
          g: parseInt(result[2], 16),
          b: parseInt(result[3], 16),
        }
      : null;
  }

  /**
   * Deep merge objects
   */
  private deepMerge(target: any, source: any): any {
    const output = { ...target };

    if (this.isObject(target) && this.isObject(source)) {
      Object.keys(source).forEach((key) => {
        if (this.isObject(source[key])) {
          if (!(key in target)) {
            Object.assign(output, { [key]: source[key] });
          } else {
            output[key] = this.deepMerge(target[key], source[key]);
          }
        } else {
          Object.assign(output, { [key]: source[key] });
        }
      });
    }

    return output;
  }

  /**
   * Check if value is an object
   */
  private isObject(item: any): boolean {
    return item && typeof item === "object" && !Array.isArray(item);
  }

  /**
   * Dispatch theme change event
   */
  private dispatchThemeChangeEvent(theme: FormlinkTheme): void {
    const event = new CustomEvent("formlink:themechange", {
      detail: { theme },
      bubbles: true,
      cancelable: false,
    });

    document.dispatchEvent(event);
  }
}
