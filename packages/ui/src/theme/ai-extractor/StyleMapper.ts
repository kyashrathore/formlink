import { PartialTheme } from "../types";

export class StyleMapper {
  /**
   * Map extracted styles to FormJunction theme structure
   */
  mapToThemeStructure(extractedStyles: any): PartialTheme {
    const theme: PartialTheme = {
      tokens: {
        colors: this.mapColors(extractedStyles.colors),
        typography: this.mapTypography(extractedStyles.typography),
        spacing: this.mapSpacing(extractedStyles.spacing),
        borders: this.mapBorders(extractedStyles.borders),
        effects: this.mapEffects(extractedStyles.effects),
        animations: this.mapAnimations(extractedStyles.animations),
        layout: this.mapLayout(extractedStyles),
      },
      components: this.mapComponents(extractedStyles),
      modes: this.mapModes(extractedStyles),
      accessibility: this.mapAccessibility(extractedStyles),
    };

    return theme;
  }

  /**
   * Map color values
   */
  private mapColors(colors: any): any {
    if (!colors) return {};

    return {
      // Primary colors
      primary: colors.primary,
      primaryHover: colors.primaryHover || this.darken(colors.primary, 10),
      primaryActive: colors.primaryActive || this.darken(colors.primary, 20),
      primaryForeground: colors.primaryForeground || "#ffffff",

      // Secondary colors
      secondary: colors.secondary || colors.primary,
      secondaryHover:
        colors.secondaryHover ||
        this.darken(colors.secondary || colors.primary, 10),
      secondaryActive:
        colors.secondaryActive ||
        this.darken(colors.secondary || colors.primary, 20),
      secondaryForeground: colors.secondaryForeground || "#ffffff",

      // Backgrounds
      background: colors.background || "#ffffff",
      backgroundAlt:
        colors.backgroundAlt || this.lighten(colors.background || "#ffffff", 5),
      backgroundOverlay: "rgba(0, 0, 0, 0.5)",

      // Text colors
      text: colors.text || "#212529",
      textMuted: colors.textMuted || this.lighten(colors.text || "#212529", 40),
      textDisabled:
        colors.textDisabled || this.lighten(colors.text || "#212529", 60),
      textPlaceholder:
        colors.textPlaceholder || this.lighten(colors.text || "#212529", 50),

      // UI colors
      border: colors.border || "#dee2e6",
      borderFocus: colors.borderFocus || colors.primary,
      borderError: colors.borderError || colors.error || "#dc3545",

      // Feedback colors
      success: colors.success || "#28a745",
      error: colors.error || "#dc3545",
      warning: colors.warning || "#ffc107",
      info: colors.info || "#17a2b8",

      // Interactive states
      hover: colors.hover || `${colors.primary}15`,
      active: colors.active || `${colors.primary}25`,
      selected: colors.selected || `${colors.primary}20`,
    };
  }

  /**
   * Map typography values
   */
  private mapTypography(typography: any): any {
    if (!typography) return {};

    return {
      fonts: {
        heading:
          typography.fonts?.heading || typography.fonts?.body || "sans-serif",
        body: typography.fonts?.body || "sans-serif",
        input:
          typography.fonts?.input || typography.fonts?.body || "sans-serif",
        button:
          typography.fonts?.button || typography.fonts?.body || "sans-serif",
        mono: typography.fonts?.mono || "monospace",
      },
      sizes: {
        questionXS: "16px",
        questionSM: "20px",
        questionMD: typography.sizes?.questionMD || "24px",
        questionLG: "28px",
        questionXL: "32px",
        questionXXL: "40px",
        bodyXS: "12px",
        bodySM: "14px",
        bodyMD: typography.sizes?.bodyMD || "16px",
        bodyLG: "18px",
        inputSM: "14px",
        inputMD: typography.sizes?.inputMD || "16px",
        inputLG: "18px",
        inputXL: "20px",
        buttonSM: "14px",
        buttonMD: "16px",
        buttonLG: "18px",
      },
      weights: {
        light: 300,
        regular: typography.weights?.regular || 400,
        medium: typography.weights?.medium || 500,
        semibold: typography.weights?.semibold || 600,
        bold: typography.weights?.bold || 700,
      },
      lineHeights: {
        tight: 1.2,
        normal: 1.5,
        relaxed: 1.75,
      },
    };
  }

  /**
   * Map spacing values
   */
  private mapSpacing(spacing: any): any {
    if (!spacing) return {};

    return {
      questionSpacing: spacing.questionSpacing || "48px",
      optionSpacing: spacing.optionSpacing || "12px",
      sectionSpacing: spacing.sectionSpacing || "64px",
      paddingXS: "4px",
      paddingSM: "8px",
      paddingMD: spacing.paddingMD || "16px",
      paddingLG: spacing.paddingLG || "24px",
      paddingXL: "32px",
      paddingXXL: "48px",
    };
  }

  /**
   * Map border values
   */
  private mapBorders(borders: any): any {
    if (!borders) return {};

    return {
      widthThin: borders.widthThin || "1px",
      widthMedium: "2px",
      widthThick: "3px",
      radiusNone: "0",
      radiusSM: "4px",
      radiusMD: borders.radiusMD || "8px",
      radiusLG: "12px",
      radiusXL: "16px",
      radiusFull: "9999px",
      inputRadius: borders.inputRadius || "4px",
      buttonRadius: borders.buttonRadius || "4px",
      cardRadius: borders.cardRadius || "8px",
    };
  }

  /**
   * Map effect values
   */
  private mapEffects(effects: any): any {
    if (!effects) return {};

    return {
      shadowNone: "none",
      shadowSM: effects.shadowSM || "0 1px 2px 0 rgba(0, 0, 0, 0.05)",
      shadowMD: effects.shadowMD || "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
      shadowLG: effects.shadowLG || "0 10px 15px -3px rgba(0, 0, 0, 0.1)",
      focusRing: effects.focusRing || "0 0 0 3px rgba(0, 123, 255, 0.25)",
      focusRingColor: effects.focusRingColor || "rgba(0, 123, 255, 0.25)",
      focusRingWidth: "3px",
      blurSM: "4px",
      blurMD: "8px",
      blurLG: "16px",
      opacityDisabled: 0.6,
      opacityHover: 0.8,
    };
  }

  /**
   * Map animation values
   */
  private mapAnimations(animations: any): any {
    if (!animations) return {};

    return {
      durationFast: "150ms",
      durationNormal: animations.durationNormal || "200ms",
      durationSlow: "300ms",
      easingLinear: "linear",
      easingIn: "ease-in",
      easingOut: "ease-out",
      easingInOut: animations.easingInOut || "ease-in-out",
      easingSpring: "cubic-bezier(0.68, -0.55, 0.265, 1.55)",
      questionEnter: {
        duration: "300ms",
        easing: "ease-out",
      },
      questionExit: {
        duration: "200ms",
        easing: "ease-in",
      },
      optionStagger: "50ms",
      optionHover: {
        scale: 1.02,
        duration: "150ms",
      },
    };
  }

  /**
   * Map layout configuration
   */
  private mapLayout(extractedStyles: any): any {
    return {
      maxWidth: "720px",
      alignment: "center" as const,
      questionAlignment: "left" as const,
      optionLayout: "vertical" as const,
      progressPosition: "top" as const,
      progressStyle: "bar" as const,
    };
  }

  /**
   * Map component-specific styles
   */
  private mapComponents(extractedStyles: any): any {
    return {
      textInput: {
        height: "48px",
        borderStyle: "outline" as const,
        focusStyle: {
          outline: `2px solid ${extractedStyles.colors?.primary || "#007bff"}`,
          borderColor: extractedStyles.colors?.primary || "#007bff",
        },
      },
      select: {
        optionHeight: "56px",
        optionBorderRadius: "8px",
        showNumbers: true,
        showLetters: true,
        numberStyle: "circle" as const,
      },
      rating: {
        iconType: "star" as const,
        iconSize: "32px",
        iconColor: "#dee2e6",
        iconColorActive: "#ffc107",
      },
    };
  }

  /**
   * Map mode-specific settings
   */
  private mapModes(extractedStyles: any): any {
    return {
      typeform: {
        background: {
          type: "color" as const,
          value: extractedStyles.colors?.background || "#ffffff",
          overlay: "transparent",
        },
        enableAnimations: true,
        animationIntensity: "normal" as const,
        showKeyboardHints: true,
        autoAdvance: false,
        autoAdvanceDelay: 750,
      },
      chat: {
        containerBackground: extractedStyles.colors?.backgroundAlt || "#f8f9fa",
        messageBubbles: {
          userBackground: extractedStyles.colors?.primary || "#007bff",
          aiBackground: "#e9ecef",
          borderRadius: "18px",
          spacing: "12px",
          maxWidth: "70%",
        },
        inputArea: {
          position: "bottom" as const,
          sendButtonStyle: "icon" as const,
        },
        avatars: {
          show: true,
          userAvatar: "",
          aiAvatar: "",
        },
        typingIndicator: {
          show: true,
          style: "dots" as const,
        },
      },
    };
  }

  /**
   * Map accessibility settings
   */
  private mapAccessibility(extractedStyles: any): any {
    return {
      highContrast: {
        borderWidth: "2px",
        focusRingWidth: "4px",
        textWeight: 500,
      },
      reducedMotion: {
        disableAnimations: false,
        instantTransitions: false,
      },
      fontSizeMultiplier: 1,
      colorBlindMode: "none" as const,
    };
  }

  /**
   * Darken a hex color by a percentage
   */
  private darken(hex: string, percent: number): string {
    const num = parseInt(hex.replace("#", ""), 16);
    const amt = Math.round(2.55 * percent);
    const R = Math.max(0, (num >> 16) - amt);
    const G = Math.max(0, ((num >> 8) & 0x00ff) - amt);
    const B = Math.max(0, (num & 0x0000ff) - amt);

    return (
      "#" + (0x1000000 + R * 0x10000 + G * 0x100 + B).toString(16).slice(1)
    );
  }

  /**
   * Lighten a hex color by a percentage
   */
  private lighten(hex: string, percent: number): string {
    const num = parseInt(hex.replace("#", ""), 16);
    const amt = Math.round(2.55 * percent);
    const R = Math.min(255, (num >> 16) + amt);
    const G = Math.min(255, ((num >> 8) & 0x00ff) + amt);
    const B = Math.min(255, (num & 0x0000ff) + amt);

    return (
      "#" + (0x1000000 + R * 0x10000 + G * 0x100 + B).toString(16).slice(1)
    );
  }
}
