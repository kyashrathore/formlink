import { FormJunctionTheme, ValidationResult } from '../types';

export class Validator {
  /**
   * Validate a complete theme
   */
  validateTheme(theme: FormJunctionTheme): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Validate structure
    this.validateStructure(theme, errors);

    // Validate colors
    this.validateColors(theme, errors, warnings);

    // Validate typography
    this.validateTypography(theme, errors, warnings);

    // Validate spacing
    this.validateSpacing(theme, errors, warnings);

    // Validate animations
    this.validateAnimations(theme, errors, warnings);

    // Validate accessibility
    this.validateAccessibility(theme, errors, warnings);

    // Validate contrast ratios
    this.validateContrast(theme, warnings);

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Validate theme structure
   */
  private validateStructure(theme: FormJunctionTheme, errors: string[]): void {
    if (!theme.tokens) {
      errors.push('Theme must have a "tokens" property');
      return;
    }

    const requiredTokens = ['colors', 'typography', 'spacing', 'borders', 'effects', 'animations', 'layout'];
    requiredTokens.forEach(token => {
      if (!theme.tokens[token as keyof typeof theme.tokens]) {
        errors.push(`Theme tokens must include "${token}"`);
      }
    });

    if (!theme.components) {
      errors.push('Theme must have a "components" property');
    }

    if (!theme.modes) {
      errors.push('Theme must have a "modes" property');
    }

    if (!theme.accessibility) {
      errors.push('Theme must have an "accessibility" property');
    }
  }

  /**
   * Validate color values
   */
  private validateColors(theme: FormJunctionTheme, errors: string[], warnings: string[]): void {
    const colors = theme.tokens?.colors;
    if (!colors) return;

    Object.entries(colors).forEach(([key, value]) => {
      if (!this.isValidColor(value)) {
        errors.push(`Invalid color value for "${key}": ${value}`);
      }
    });

    // Check for required color properties
    const requiredColors = ['primary', 'background', 'text', 'border', 'error'];
    requiredColors.forEach(color => {
      if (!colors[color as keyof typeof colors]) {
        errors.push(`Missing required color: "${color}"`);
      }
    });
  }

  /**
   * Validate typography values
   */
  private validateTypography(theme: FormJunctionTheme, errors: string[], warnings: string[]): void {
    const typography = theme.tokens?.typography;
    if (!typography) return;

    // Validate font families
    if (!typography.fonts?.body) {
      errors.push('Missing required font: "body"');
    }

    // Validate font sizes
    Object.entries(typography.sizes || {}).forEach(([key, value]) => {
      if (!this.isValidSize(value)) {
        errors.push(`Invalid font size for "${key}": ${value}`);
      }
    });

    // Validate font weights
    Object.entries(typography.weights || {}).forEach(([key, value]) => {
      if (typeof value !== 'number' || value < 100 || value > 900) {
        errors.push(`Invalid font weight for "${key}": ${value}. Must be between 100 and 900.`);
      }
    });
  }

  /**
   * Validate spacing values
   */
  private validateSpacing(theme: FormJunctionTheme, errors: string[], warnings: string[]): void {
    const spacing = theme.tokens?.spacing;
    if (!spacing) return;

    Object.entries(spacing).forEach(([key, value]) => {
      if (!this.isValidSize(value)) {
        errors.push(`Invalid spacing value for "${key}": ${value}`);
      }
    });
  }

  /**
   * Validate animation values
   */
  private validateAnimations(theme: FormJunctionTheme, errors: string[], warnings: string[]): void {
    const animations = theme.tokens?.animations;
    if (!animations) return;

    // Validate durations
    ['durationFast', 'durationNormal', 'durationSlow'].forEach(duration => {
      const value = animations[duration as keyof typeof animations];
      if (typeof value === 'string' && !this.isValidDuration(value)) {
        errors.push(`Invalid animation duration for "${duration}": ${value}`);
      }
    });

    // Validate animation configs
    if (animations.questionEnter && !this.isValidAnimationConfig(animations.questionEnter)) {
      errors.push('Invalid animation config for "questionEnter"');
    }

    if (animations.questionExit && !this.isValidAnimationConfig(animations.questionExit)) {
      errors.push('Invalid animation config for "questionExit"');
    }
  }

  /**
   * Validate accessibility settings
   */
  private validateAccessibility(theme: FormJunctionTheme, errors: string[], warnings: string[]): void {
    const accessibility = theme.accessibility;
    if (!accessibility) return;

    // Validate font size multiplier
    if (accessibility.fontSizeMultiplier !== undefined) {
      if (typeof accessibility.fontSizeMultiplier !== 'number' || 
          accessibility.fontSizeMultiplier < 0.5 || 
          accessibility.fontSizeMultiplier > 3) {
        errors.push('Font size multiplier must be between 0.5 and 3');
      }
    }

    // Validate color blind mode
    const validColorBlindModes = ['none', 'protanopia', 'deuteranopia', 'tritanopia'];
    if (accessibility.colorBlindMode && !validColorBlindModes.includes(accessibility.colorBlindMode)) {
      errors.push(`Invalid color blind mode: ${accessibility.colorBlindMode}`);
    }
  }

  /**
   * Validate contrast ratios
   */
  private validateContrast(theme: FormJunctionTheme, warnings: string[]): void {
    const colors = theme.tokens?.colors;
    if (!colors) return;

    // Check primary text contrast
    const bgContrast = this.getContrastRatio(colors.background, colors.text);
    if (bgContrast < 4.5) {
      warnings.push(`Low contrast ratio (${bgContrast.toFixed(2)}) between background and text. WCAG AA requires 4.5:1`);
    }

    // Check primary button contrast
    if (colors.primary && colors.primaryForeground) {
      const btnContrast = this.getContrastRatio(colors.primary, colors.primaryForeground);
      if (btnContrast < 4.5) {
        warnings.push(`Low contrast ratio (${btnContrast.toFixed(2)}) for primary button. WCAG AA requires 4.5:1`);
      }
    }

    // Check error text contrast
    if (colors.error && colors.background) {
      const errorContrast = this.getContrastRatio(colors.background, colors.error);
      if (errorContrast < 4.5) {
        warnings.push(`Low contrast ratio (${errorContrast.toFixed(2)}) for error text. WCAG AA requires 4.5:1`);
      }
    }
  }

  /**
   * Check if color value is valid
   */
  private isValidColor(color: string): boolean {
    // Check hex colors
    if (/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(color)) {
      return true;
    }

    // Check RGB/RGBA
    if (/^rgba?\((\d{1,3},\s*){2}\d{1,3}(,\s*(0|1|0?\.\d+))?\)$/.test(color)) {
      return true;
    }

    // Check HSL/HSLA
    if (/^hsla?\(\d{1,3},\s*\d{1,3}%,\s*\d{1,3}%(,\s*(0|1|0?\.\d+))?\)$/.test(color)) {
      return true;
    }

    // Check CSS color names
    const cssColors = ['transparent', 'inherit', 'currentColor'];
    if (cssColors.includes(color)) {
      return true;
    }

    return false;
  }

  /**
   * Check if size value is valid
   */
  private isValidSize(size: string): boolean {
    return /^\d+(\.\d+)?(px|rem|em|%|vh|vw)$/.test(size);
  }

  /**
   * Check if duration value is valid
   */
  private isValidDuration(duration: string): boolean {
    return /^\d+(\.\d+)?(ms|s)$/.test(duration);
  }

  /**
   * Check if animation config is valid
   */
  private isValidAnimationConfig(config: any): boolean {
    return (
      typeof config === 'object' &&
      config.duration &&
      this.isValidDuration(config.duration) &&
      config.easing &&
      typeof config.easing === 'string'
    );
  }

  /**
   * Calculate contrast ratio between two colors
   */
  private getContrastRatio(color1: string, color2: string): number {
    const lum1 = this.getLuminance(color1);
    const lum2 = this.getLuminance(color2);
    
    const brightest = Math.max(lum1, lum2);
    const darkest = Math.min(lum1, lum2);
    
    return (brightest + 0.05) / (darkest + 0.05);
  }

  /**
   * Calculate relative luminance of a color
   */
  private getLuminance(color: string): number {
    const rgb = this.hexToRgb(color);
    if (!rgb) return 0;

    const { r, g, b } = rgb;
    const [rs, gs, bs] = [r, g, b].map(c => {
      c = c / 255;
      return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    });

    return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
  }

  /**
   * Convert hex to RGB
   */
  private hexToRgb(hex: string): { r: number; g: number; b: number } | null {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    } : null;
  }
}