import { FormJunctionTheme, PartialTheme, ValidationResult } from '../types';
import { WebCrawler, CrawlResult } from './WebCrawler';
import { StyleMapper } from './StyleMapper';
import { defaultTheme } from '../presets/default';

export interface AIThemeExtractor {
  extractFromUrl(url: string): Promise<FormJunctionTheme>;
  extractFromScreenshot(image: string): Promise<PartialTheme>;
  validateTheme(theme: PartialTheme): ValidationResult;
  enhanceTheme(theme: PartialTheme): FormJunctionTheme;
}

export class AIThemeExtractorImpl implements AIThemeExtractor {
  private webCrawler: WebCrawler;
  private styleMapper: StyleMapper;

  constructor() {
    this.webCrawler = new WebCrawler();
    this.styleMapper = new StyleMapper();
  }

  /**
   * Extract theme from a website URL
   */
  async extractFromUrl(url: string): Promise<FormJunctionTheme> {
    try {
      // 1. Crawl the website
      console.log(`Starting theme extraction from: ${url}`);
      const crawlResult = await this.webCrawler.crawlWebsite(url);
      
      // 2. Extract styles from DOM
      const extractedStyles = {
        colors: this.extractColors(crawlResult),
        typography: this.extractTypography(crawlResult),
        spacing: this.extractSpacing(crawlResult),
        borders: this.extractBorders(crawlResult),
        effects: this.extractEffects(crawlResult),
        animations: this.extractAnimations(crawlResult)
      };
      
      // 3. Map to Formfiller theme structure
      const mappedTheme = this.styleMapper.mapToThemeStructure(extractedStyles);
      
      // 4. Validate and enhance
      const enhancedTheme = this.enhanceTheme(mappedTheme);
      
      console.log('Theme extraction completed successfully');
      return enhancedTheme;
    } catch (error) {
      console.error('Failed to extract theme from URL:', error);
      throw new Error(`Theme extraction failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Extract theme from a screenshot
   */
  async extractFromScreenshot(image: string): Promise<PartialTheme> {
    // This would integrate with an AI vision API to analyze the screenshot
    // For now, we'll return a placeholder implementation
    console.log('Screenshot theme extraction is not yet implemented');
    
    // Placeholder: In a real implementation, this would:
    // 1. Send the image to an AI vision API
    // 2. Extract dominant colors, typography hints, layout patterns
    // 3. Map to partial theme structure
    
    return {
      tokens: {
        colors: {
          primary: '#007bff',
          background: '#ffffff',
          text: '#212529'
        }
      }
    };
  }

  /**
   * Validate a partial theme
   */
  validateTheme(theme: PartialTheme): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check if theme has at least some required properties
    if (!theme.tokens?.colors?.primary) {
      warnings.push('Missing primary color - will use default');
    }

    if (!theme.tokens?.colors?.background) {
      warnings.push('Missing background color - will use default');
    }

    if (!theme.tokens?.colors?.text) {
      warnings.push('Missing text color - will use default');
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Enhance a partial theme to a complete theme
   */
  enhanceTheme(partialTheme: PartialTheme): FormJunctionTheme {
    // Start with default theme as base
    const enhancedTheme = JSON.parse(JSON.stringify(defaultTheme)) as FormJunctionTheme;

    // Deep merge partial theme
    this.deepMerge(enhancedTheme, partialTheme);

    // Generate complementary colors if needed
    if (partialTheme.tokens?.colors?.primary) {
      const primary = partialTheme.tokens.colors.primary;
      
      // Generate hover and active states if not provided
      if (!enhancedTheme.tokens.colors.primaryHover) {
        enhancedTheme.tokens.colors.primaryHover = this.adjustBrightness(primary, -20);
      }
      if (!enhancedTheme.tokens.colors.primaryActive) {
        enhancedTheme.tokens.colors.primaryActive = this.adjustBrightness(primary, -40);
      }
      
      // Update focus colors to match primary
      enhancedTheme.tokens.colors.borderFocus = primary;
      enhancedTheme.tokens.effects.focusRingColor = `${primary}40`; // 25% opacity
    }

    // Ensure contrast ratios are met
    this.ensureContrast(enhancedTheme);

    return enhancedTheme;
  }

  /**
   * Extract colors from crawl result
   */
  private extractColors(crawlData: CrawlResult): any {
    const colors: any = {};

    // Extract primary colors from buttons and links
    if (crawlData.styles.buttons.length > 0) {
      const primaryButton = crawlData.styles.buttons.find(b => b.isPrimary) || crawlData.styles.buttons[0];
      colors.primary = primaryButton.backgroundColor;
      colors.primaryForeground = primaryButton.color;
    }

    // Extract background colors
    colors.background = crawlData.styles.background.primary;
    colors.backgroundAlt = crawlData.styles.background.secondary || this.adjustBrightness(colors.background, 5);

    // Extract text colors
    colors.text = crawlData.styles.text.primary;
    colors.textMuted = crawlData.styles.text.secondary || this.adjustBrightness(colors.text, 40);

    // Extract UI colors
    colors.border = crawlData.styles.borders.color || '#dee2e6';
    colors.borderFocus = colors.primary || '#007bff';

    // Extract feedback colors
    colors.success = crawlData.styles.feedback?.success || '#28a745';
    colors.error = crawlData.styles.feedback?.error || '#dc3545';
    colors.warning = crawlData.styles.feedback?.warning || '#ffc107';
    colors.info = crawlData.styles.feedback?.info || '#17a2b8';

    return colors;
  }

  /**
   * Extract typography from crawl result
   */
  private extractTypography(crawlData: CrawlResult): any {
    return {
      fonts: {
        heading: crawlData.styles.typography.headingFont,
        body: crawlData.styles.typography.bodyFont,
        input: crawlData.styles.typography.bodyFont,
        button: crawlData.styles.typography.bodyFont,
        mono: 'monospace'
      },
      sizes: {
        questionMD: crawlData.styles.typography.headingSizes.h2 || '24px',
        bodyMD: crawlData.styles.typography.bodySizes.medium || '16px',
        inputMD: crawlData.styles.typography.inputSize || '16px'
      },
      weights: {
        regular: 400,
        medium: 500,
        semibold: 600,
        bold: parseInt(crawlData.styles.typography.headingWeight) || 700
      }
    };
  }

  /**
   * Extract spacing from crawl result
   */
  private extractSpacing(crawlData: CrawlResult): any {
    return {
      paddingMD: crawlData.styles.spacing.medium || '16px',
      paddingLG: crawlData.styles.spacing.large || '24px',
      questionSpacing: '48px',
      optionSpacing: '12px'
    };
  }

  /**
   * Extract borders from crawl result
   */
  private extractBorders(crawlData: CrawlResult): any {
    return {
      widthThin: crawlData.styles.borders.width || '1px',
      radiusMD: crawlData.styles.borders.radius || '8px',
      inputRadius: crawlData.styles.inputs?.borderRadius || '4px',
      buttonRadius: crawlData.styles.buttons[0]?.borderRadius || '4px'
    };
  }

  /**
   * Extract effects from crawl result
   */
  private extractEffects(crawlData: CrawlResult): any {
    return {
      shadowMD: crawlData.styles.shadows.medium || '0 4px 6px rgba(0, 0, 0, 0.1)',
      focusRing: `0 0 0 3px ${crawlData.styles.colors?.primary || '#007bff'}40`
    };
  }

  /**
   * Extract animations from crawl result
   */
  private extractAnimations(crawlData: CrawlResult): any {
    return {
      durationNormal: crawlData.styles.animations?.duration || '200ms',
      easingInOut: crawlData.styles.animations?.easing || 'ease-in-out'
    };
  }

  /**
   * Deep merge objects
   */
  private deepMerge(target: any, source: any): void {
    for (const key in source) {
      if (source.hasOwnProperty(key)) {
        if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
          if (!target[key]) {
            target[key] = {};
          }
          this.deepMerge(target[key], source[key]);
        } else {
          target[key] = source[key];
        }
      }
    }
  }

  /**
   * Adjust color brightness
   */
  private adjustBrightness(hex: string, percent: number): string {
    const num = parseInt(hex.replace('#', ''), 16);
    const amt = Math.round(2.55 * percent);
    const R = (num >> 16) + amt;
    const G = (num >> 8 & 0x00FF) + amt;
    const B = (num & 0x0000FF) + amt;
    
    return '#' + (0x1000000 + (R < 255 ? R < 1 ? 0 : R : 255) * 0x10000 +
      (G < 255 ? G < 1 ? 0 : G : 255) * 0x100 +
      (B < 255 ? B < 1 ? 0 : B : 255))
      .toString(16)
      .slice(1);
  }

  /**
   * Ensure minimum contrast ratios
   */
  private ensureContrast(theme: FormJunctionTheme): void {
    // This would implement WCAG contrast checking and adjustment
    // For now, we'll trust the extracted/enhanced colors
  }
}