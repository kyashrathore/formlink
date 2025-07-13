/**
 * Animation configuration for motion effects
 */
export interface AnimationConfig {
  /** Animation duration (e.g., '200ms', '0.3s') */
  duration: string;
  /** Easing function (e.g., 'ease-in-out', 'cubic-bezier(...)') */
  easing: string;
  /** Animation delay before starting */
  delay?: string;
  /** Animation fill mode */
  fill?: "forwards" | "backwards" | "both" | "none";
}

/**
 * Focus state styling configuration
 */
export interface ComponentFocusStyle {
  /** Outline style for focus */
  outline?: string;
  /** Border color when focused */
  borderColor?: string;
  /** Box shadow for focus ring */
  boxShadow?: string;
  /** Background color when focused */
  backgroundColor?: string;
}

/**
 * Button styling configuration
 */
export interface ButtonStyle {
  /** Default background color */
  background: string;
  /** Background color on hover */
  backgroundHover: string;
  /** Background color when active/pressed */
  backgroundActive: string;
  /** Text color */
  text: string;
  /** Text color on hover */
  textHover: string;
  /** Border style */
  border: string;
  /** Border style on hover */
  borderHover: string;
  /** Border radius */
  borderRadius: string;
  /** Padding */
  padding: string;
  /** Font size */
  fontSize: string;
  /** Font weight */
  fontWeight: number;
  /** Optional box shadow */
  boxShadow?: string;
}

/**
 * Comprehensive FormJunction Theme Interface
 *
 * @description
 * The complete theme configuration for FormJunction UI. Provides
 * design tokens, component overrides, mode-specific settings, and
 * accessibility options. Supports deep customization while maintaining
 * consistency across the design system.
 */
export interface FormJunctionTheme {
  // Global Design Tokens
  tokens: {
    // Colors - Complete Palette
    colors: {
      // Primary brand colors
      primary: string;
      primaryHover: string;
      primaryActive: string;
      primaryForeground: string;

      // Secondary colors
      secondary: string;
      secondaryHover: string;
      secondaryActive: string;
      secondaryForeground: string;

      // Backgrounds
      background: string;
      backgroundAlt: string;
      backgroundOverlay: string;

      // Text colors
      text: string;
      textMuted: string;
      textDisabled: string;
      textPlaceholder: string;

      // UI colors
      border: string;
      borderFocus: string;
      borderError: string;

      // Feedback colors
      success: string;
      error: string;
      warning: string;
      info: string;

      // Interactive states
      hover: string;
      active: string;
      selected: string;
    };

    // Typography
    typography: {
      fonts: {
        heading: string;
        body: string;
        input: string;
        button: string;
        mono: string;
      };

      sizes: {
        // Question sizes (TypeForm style)
        questionXS: string; // 16px
        questionSM: string; // 20px
        questionMD: string; // 24px
        questionLG: string; // 28px
        questionXL: string; // 32px
        questionXXL: string; // 40px

        // Body text
        bodyXS: string; // 12px
        bodySM: string; // 14px
        bodyMD: string; // 16px
        bodyLG: string; // 18px

        // Input text
        inputSM: string; // 14px
        inputMD: string; // 16px
        inputLG: string; // 18px
        inputXL: string; // 20px

        // Button text
        buttonSM: string; // 14px
        buttonMD: string; // 16px
        buttonLG: string; // 18px
      };

      weights: {
        light: number; // 300
        regular: number; // 400
        medium: number; // 500
        semibold: number; // 600
        bold: number; // 700
      };

      lineHeights: {
        tight: number; // 1.2
        normal: number; // 1.5
        relaxed: number; // 1.75
      };
    };

    // Spacing & Layout
    spacing: {
      questionSpacing: string;
      optionSpacing: string;
      sectionSpacing: string;

      paddingXS: string; // 4px
      paddingSM: string; // 8px
      paddingMD: string; // 16px
      paddingLG: string; // 24px
      paddingXL: string; // 32px
      paddingXXL: string; // 48px
    };

    // Borders & Radius
    borders: {
      widthThin: string; // 1px
      widthMedium: string; // 2px
      widthThick: string; // 3px

      radiusNone: string; // 0
      radiusSM: string; // 4px
      radiusMD: string; // 8px
      radiusLG: string; // 12px
      radiusXL: string; // 16px
      radiusFull: string; // 9999px

      inputRadius: string;
      buttonRadius: string;
      cardRadius: string;
    };

    // Effects
    effects: {
      shadowNone: string;
      shadowSM: string;
      shadowMD: string;
      shadowLG: string;

      focusRing: string;
      focusRingColor: string;
      focusRingWidth: string;

      blurSM: string; // 4px
      blurMD: string; // 8px
      blurLG: string; // 16px

      opacityDisabled: number;
      opacityHover: number;
    };

    // Animations
    animations: {
      durationFast: string; // 150ms
      durationNormal: string; // 200ms
      durationSlow: string; // 300ms

      easingLinear: string;
      easingIn: string;
      easingOut: string;
      easingInOut: string;
      easingSpring: string;

      questionEnter: AnimationConfig;
      questionExit: AnimationConfig;
      optionStagger: string;
      optionHover: { scale: number; duration: string };
    };

    // Layout Configuration
    layout: {
      maxWidth: string;
      alignment: "left" | "center" | "right";
      questionAlignment: "left" | "center" | "right";
      optionLayout: "vertical" | "horizontal" | "grid";
      progressPosition: "top" | "bottom" | "none";
      progressStyle: "bar" | "dots" | "numbers";
    };
  };

  // Component-Specific Overrides
  components: {
    textInput: {
      height: string;
      borderStyle: "none" | "underline" | "outline" | "filled";
      focusStyle: ComponentFocusStyle;
    };

    select: {
      optionHeight: string;
      optionBorderRadius: string;
      showNumbers: boolean;
      showLetters: boolean;
      numberStyle: "circle" | "square" | "none";
    };

    rating: {
      iconType: "star" | "heart" | "thumbs" | "number";
      iconSize: string;
      iconColor: string;
      iconColorActive: string;
    };

    button: {
      primary: ButtonStyle;
      secondary: ButtonStyle;
    };

    fileUpload: {
      dropzoneHeight: string;
      dropzoneBorder: string;
      dropzoneBackground: string;
      iconSize: string;
    };

    datePicker: {
      calendarTheme: "light" | "dark" | "auto";
      headerBackground: string;
      selectedDayBackground: string;
      todayBorderColor: string;
    };

    progress: {
      bar: {
        height: string;
        backgroundColor: string;
        fillColor: string;
        showPercentage: boolean;
      };
      dots: {
        size: string;
        color: string;
        activeColor: string;
      };
    };
  };

  // Mode-Specific Settings
  modes: {
    typeform: {
      background: {
        type: "color" | "gradient" | "image";
        value: string;
        overlay: string;
      };
      enableAnimations: boolean;
      animationIntensity: "subtle" | "normal" | "playful";
      showKeyboardHints: boolean;
      autoAdvance: boolean;
      autoAdvanceDelay: number;
    };

    chat: {
      containerBackground: string;
      messageBubbles: {
        userBackground: string;
        aiBackground: string;
        borderRadius: string;
        spacing: string;
        maxWidth: string;
      };
      inputArea: {
        position: "bottom" | "floating";
        sendButtonStyle: "icon" | "text" | "both";
      };
      avatars: {
        show: boolean;
        userAvatar: string;
        aiAvatar: string;
      };
      typingIndicator: {
        show: boolean;
        style: "dots" | "text" | "pulse";
      };
    };
  };

  // Accessibility Overrides
  accessibility: {
    highContrast: {
      borderWidth: string;
      focusRingWidth: string;
      textWeight: number;
    };
    reducedMotion: {
      disableAnimations: boolean;
      instantTransitions: boolean;
    };
    fontSizeMultiplier: number;
    colorBlindMode: "none" | "protanopia" | "deuteranopia" | "tritanopia";
  };
}

// Validation result interface
export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

// Theme preset type
export type ThemePreset =
  | "default"
  | "dark"
  | "typeform"
  | "minimal"
  | "colorful"
  | "enterprise";

// Partial theme for overrides
export type PartialTheme = DeepPartial<FormJunctionTheme>;

// Deep partial utility type
type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};
