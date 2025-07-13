import { FormJunctionTheme } from '../types';

export class CSSGenerator {
  /**
   * Generate CSS variables from theme
   */
  generateCSSVariables(theme: FormJunctionTheme): Map<string, string> {
    const cssVarMap = new Map<string, string>();

    // Generate color variables
    this.generateColorVariables(theme, cssVarMap);
    
    // Generate typography variables
    this.generateTypographyVariables(theme, cssVarMap);
    
    // Generate spacing variables
    this.generateSpacingVariables(theme, cssVarMap);
    
    // Generate border variables
    this.generateBorderVariables(theme, cssVarMap);
    
    // Generate effect variables
    this.generateEffectVariables(theme, cssVarMap);
    
    // Generate animation variables
    this.generateAnimationVariables(theme, cssVarMap);
    
    // Generate layout variables
    this.generateLayoutVariables(theme, cssVarMap);
    
    // Generate component-specific variables
    this.generateComponentVariables(theme, cssVarMap);
    
    // Generate mode-specific variables
    this.generateModeVariables(theme, cssVarMap);

    return cssVarMap;
  }

  /**
   * Generate color CSS variables
   */
  private generateColorVariables(theme: FormJunctionTheme, cssVarMap: Map<string, string>): void {
    Object.entries(theme.tokens.colors).forEach(([key, value]) => {
      cssVarMap.set(`--fj-color-${this.kebabCase(key)}`, value);
      
      // Generate RGB values for opacity utilities
      const rgb = this.hexToRgb(value);
      if (rgb) {
        cssVarMap.set(`--fj-color-${this.kebabCase(key)}-rgb`, `${rgb.r}, ${rgb.g}, ${rgb.b}`);
      }
    });
  }

  /**
   * Generate typography CSS variables
   */
  private generateTypographyVariables(theme: FormJunctionTheme, cssVarMap: Map<string, string>): void {
    const { typography } = theme.tokens;

    // Fonts
    Object.entries(typography.fonts).forEach(([key, value]) => {
      cssVarMap.set(`--fj-font-${key}`, value);
    });

    // Sizes
    Object.entries(typography.sizes).forEach(([key, value]) => {
      cssVarMap.set(`--fj-text-${key}`, value);
    });

    // Weights
    Object.entries(typography.weights).forEach(([key, value]) => {
      cssVarMap.set(`--fj-font-weight-${key}`, String(value));
    });

    // Line heights
    Object.entries(typography.lineHeights).forEach(([key, value]) => {
      cssVarMap.set(`--fj-line-height-${key}`, String(value));
    });
  }

  /**
   * Generate spacing CSS variables
   */
  private generateSpacingVariables(theme: FormJunctionTheme, cssVarMap: Map<string, string>): void {
    Object.entries(theme.tokens.spacing).forEach(([key, value]) => {
      cssVarMap.set(`--fj-spacing-${this.kebabCase(key)}`, value);
    });
  }

  /**
   * Generate border CSS variables
   */
  private generateBorderVariables(theme: FormJunctionTheme, cssVarMap: Map<string, string>): void {
    Object.entries(theme.tokens.borders).forEach(([key, value]) => {
      cssVarMap.set(`--fj-border-${this.kebabCase(key)}`, value);
    });
  }

  /**
   * Generate effect CSS variables
   */
  private generateEffectVariables(theme: FormJunctionTheme, cssVarMap: Map<string, string>): void {
    Object.entries(theme.tokens.effects).forEach(([key, value]) => {
      cssVarMap.set(`--fj-effect-${this.kebabCase(key)}`, String(value));
    });
  }

  /**
   * Generate animation CSS variables
   */
  private generateAnimationVariables(theme: FormJunctionTheme, cssVarMap: Map<string, string>): void {
    const { animations } = theme.tokens;

    // Durations
    cssVarMap.set('--fj-duration-fast', animations.durationFast);
    cssVarMap.set('--fj-duration-normal', animations.durationNormal);
    cssVarMap.set('--fj-duration-slow', animations.durationSlow);

    // Easings
    cssVarMap.set('--fj-easing-linear', animations.easingLinear);
    cssVarMap.set('--fj-easing-in', animations.easingIn);
    cssVarMap.set('--fj-easing-out', animations.easingOut);
    cssVarMap.set('--fj-easing-in-out', animations.easingInOut);
    cssVarMap.set('--fj-easing-spring', animations.easingSpring);

    // Complex animations
    cssVarMap.set('--fj-animation-question-enter', this.generateAnimationString(animations.questionEnter));
    cssVarMap.set('--fj-animation-question-exit', this.generateAnimationString(animations.questionExit));
    cssVarMap.set('--fj-animation-option-stagger', animations.optionStagger);
    cssVarMap.set('--fj-animation-option-hover-scale', String(animations.optionHover.scale));
    cssVarMap.set('--fj-animation-option-hover-duration', animations.optionHover.duration);
  }

  /**
   * Generate layout CSS variables
   */
  private generateLayoutVariables(theme: FormJunctionTheme, cssVarMap: Map<string, string>): void {
    const { layout } = theme.tokens;

    cssVarMap.set('--fj-layout-max-width', layout.maxWidth);
    cssVarMap.set('--fj-layout-alignment', layout.alignment);
    cssVarMap.set('--fj-layout-question-alignment', layout.questionAlignment);
    cssVarMap.set('--fj-layout-option-layout', layout.optionLayout);
    cssVarMap.set('--fj-layout-progress-position', layout.progressPosition);
    cssVarMap.set('--fj-layout-progress-style', layout.progressStyle);
  }

  /**
   * Generate component-specific CSS variables
   */
  private generateComponentVariables(theme: FormJunctionTheme, cssVarMap: Map<string, string>): void {
    Object.entries(theme.components).forEach(([component, styles]) => {
      Object.entries(styles).forEach(([prop, value]) => {
        if (typeof value === 'object' && value !== null) {
          // Handle nested properties
          Object.entries(value).forEach(([nestedProp, nestedValue]) => {
            cssVarMap.set(
              `--fj-${this.kebabCase(component)}-${this.kebabCase(prop)}-${this.kebabCase(nestedProp)}`,
              String(nestedValue)
            );
          });
        } else {
          cssVarMap.set(`--fj-${this.kebabCase(component)}-${this.kebabCase(prop)}`, String(value));
        }
      });
    });
  }

  /**
   * Generate mode-specific CSS variables
   */
  private generateModeVariables(theme: FormJunctionTheme, cssVarMap: Map<string, string>): void {
    // TypeForm mode
    const { typeform } = theme.modes;
    cssVarMap.set('--fj-typeform-bg-type', typeform.background.type);
    cssVarMap.set('--fj-typeform-bg-value', typeform.background.value);
    cssVarMap.set('--fj-typeform-bg-overlay', typeform.background.overlay);
    cssVarMap.set('--fj-typeform-animations-enabled', typeform.enableAnimations ? '1' : '0');
    cssVarMap.set('--fj-typeform-animation-intensity', typeform.animationIntensity);
    cssVarMap.set('--fj-typeform-keyboard-hints', typeform.showKeyboardHints ? '1' : '0');
    cssVarMap.set('--fj-typeform-auto-advance', typeform.autoAdvance ? '1' : '0');
    cssVarMap.set('--fj-typeform-auto-advance-delay', String(typeform.autoAdvanceDelay));

    // Chat mode
    const { chat } = theme.modes;
    cssVarMap.set('--fj-chat-container-bg', chat.containerBackground);
    cssVarMap.set('--fj-chat-user-bubble-bg', chat.messageBubbles.userBackground);
    cssVarMap.set('--fj-chat-ai-bubble-bg', chat.messageBubbles.aiBackground);
    cssVarMap.set('--fj-chat-bubble-radius', chat.messageBubbles.borderRadius);
    cssVarMap.set('--fj-chat-bubble-spacing', chat.messageBubbles.spacing);
    cssVarMap.set('--fj-chat-bubble-max-width', chat.messageBubbles.maxWidth);
    cssVarMap.set('--fj-chat-input-position', chat.inputArea.position);
    cssVarMap.set('--fj-chat-send-button-style', chat.inputArea.sendButtonStyle);
    cssVarMap.set('--fj-chat-show-avatars', chat.avatars.show ? '1' : '0');
    cssVarMap.set('--fj-chat-typing-indicator', chat.typingIndicator.show ? '1' : '0');
    cssVarMap.set('--fj-chat-typing-style', chat.typingIndicator.style);
  }

  /**
   * Generate animation string from config
   */
  private generateAnimationString(config: any): string {
    if (typeof config === 'object' && config.duration && config.easing) {
      return `${config.duration} ${config.easing} ${config.delay || '0s'} ${config.fill || 'none'}`;
    }
    return '';
  }

  /**
   * Convert camelCase to kebab-case
   */
  private kebabCase(str: string): string {
    return str
      .replace(/([a-z0-9]|(?=[A-Z]))([A-Z])/g, '$1-$2')
      .toLowerCase();
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