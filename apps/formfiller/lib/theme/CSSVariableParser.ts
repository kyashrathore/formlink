/**
 * CSS Variable Parser for shadcn/ui themes
 * Parses CSS from tweakcn.com and extracts root variables
 */

export interface ParsedCSSVariables {
  root: Record<string, string>;
  dark: Record<string, string>;
}

export interface CSSParseResult {
  success: boolean;
  variables?: ParsedCSSVariables;
  error?: string;
  warnings: string[];
}

export class CSSVariableParser {
  /**
   * Parse CSS string containing :root and .dark selectors
   * Extracts CSS custom properties from both light and dark themes
   */
  static parseCSS(cssText: string): CSSParseResult {
    const result: CSSParseResult = {
      success: false,
      warnings: [],
    };

    try {
      const variables: ParsedCSSVariables = {
        root: {},
        dark: {},
      };

      // Clean and normalize CSS text
      const cleanCSS = this.cleanCSS(cssText);

      // Extract :root variables
      const rootVariables = this.extractVariablesFromSelector(
        cleanCSS,
        ":root",
      );
      variables.root = rootVariables;

      // Extract .dark variables
      const darkVariables = this.extractVariablesFromSelector(
        cleanCSS,
        ".dark",
      );
      variables.dark = darkVariables;

      // Validation
      if (Object.keys(rootVariables).length === 0) {
        result.warnings.push("No :root variables found");
      }

      if (Object.keys(darkVariables).length === 0) {
        result.warnings.push(
          "No .dark variables found - dark mode will not be available",
        );
      }

      // Validate common shadcn variables are present
      const requiredVars = [
        "--background",
        "--foreground",
        "--primary",
        "--primary-foreground",
      ];
      const missingVars = requiredVars.filter((v) => !rootVariables[v]);

      if (missingVars.length > 0) {
        result.warnings.push(
          `Missing common shadcn variables: ${missingVars.join(", ")}`,
        );
      }

      result.success = true;
      result.variables = variables;
    } catch (error) {
      result.success = false;
      result.error =
        error instanceof Error ? error.message : "Unknown parsing error";
    }

    return result;
  }

  /**
   * Extract CSS variables from a specific selector
   */
  private static extractVariablesFromSelector(
    cssText: string,
    selector: string,
  ): Record<string, string> {
    const variables: Record<string, string> = {};

    // Create regex to match the selector and its content
    const selectorRegex = new RegExp(
      `${this.escapeRegex(selector)}\\s*\\{([^}]*?)\\}`,
      "gis",
    );

    const match = selectorRegex.exec(cssText);
    if (!match || !match[1]) {
      return variables;
    }

    const selectorContent = match[1];

    // Extract CSS custom properties (--variable-name: value;)
    const variableRegex = /--([\w-]+)\s*:\s*([^;]+);?/g;
    let variableMatch;

    while ((variableMatch = variableRegex.exec(selectorContent)) !== null) {
      const varName = `--${variableMatch[1]?.trim() || ""}`;
      const varValue = variableMatch[2]?.trim() || "";

      // Validate variable value
      if (this.isValidCSSValue(varValue)) {
        variables[varName] = varValue;
      }
    }

    return variables;
  }

  /**
   * Clean and normalize CSS text
   */
  private static cleanCSS(cssText: string): string {
    return cssText
      .replace(/\/\*[\s\S]*?\*\//g, "") // Remove comments
      .replace(/\s+/g, " ") // Normalize whitespace
      .trim();
  }

  /**
   * Escape special regex characters
   */
  private static escapeRegex(text: string): string {
    return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  /**
   * Validate CSS value
   */
  private static isValidCSSValue(value: string): boolean {
    if (!value || value.trim().length === 0) return false;

    // Basic validation - allow most CSS values
    // This is permissive to handle oklch, hsl, hex, rgb, etc.
    const invalidChars = /[<>]/;
    return !invalidChars.test(value);
  }

  /**
   * Convert variables to CSS string
   */
  static variablesToCSS(variables: ParsedCSSVariables): string {
    let css = "";

    // Add :root variables
    if (Object.keys(variables.root).length > 0) {
      css += ":root {\n";
      Object.entries(variables.root).forEach(([name, value]) => {
        css += `  ${name}: ${value};\n`;
      });
      css += "}\n\n";
    }

    // Add .dark variables
    if (Object.keys(variables.dark).length > 0) {
      css += ".dark {\n";
      Object.entries(variables.dark).forEach(([name, value]) => {
        css += `  ${name}: ${value};\n`;
      });
      css += "}\n";
    }

    return css;
  }

  /**
   * Validate that required shadcn variables are present
   */
  static validateShadcnVariables(variables: Record<string, string>): string[] {
    const required = [
      "--background",
      "--foreground",
      "--primary",
      "--primary-foreground",
      "--secondary",
      "--secondary-foreground",
      "--muted",
      "--muted-foreground",
      "--border",
      "--input",
      "--ring",
    ];

    return required.filter((v) => !variables[v]);
  }
}
