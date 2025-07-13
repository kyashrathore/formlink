// Export types
export * from "./types";

// Export theme engine
export { ThemeEngine } from "./engine/ThemeEngine";
export { CSSGenerator } from "./engine/CSSGenerator";
export { Validator } from "./engine/Validator";

// Export presets
export { defaultTheme } from "./presets/default";
export { darkTheme } from "./presets/dark";
export { typeformTheme } from "./presets/typeform";

// Export AI extractor
export { AIThemeExtractorImpl as AIThemeExtractor } from "./ai-extractor/AIExtractor";
export type { AIThemeExtractor as AIThemeExtractorInterface } from "./ai-extractor/AIExtractor";

// Re-export commonly used types for convenience
export type {
  FormJunctionTheme,
  PartialTheme,
  ValidationResult,
  ThemePreset,
  AnimationConfig,
  ComponentFocusStyle,
  ButtonStyle,
} from "./types";
