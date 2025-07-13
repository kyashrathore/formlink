import { FormJunctionTheme } from '../types';

export const defaultTheme: FormJunctionTheme = {
  tokens: {
    colors: {
      // Primary brand colors
      primary: '#007bff',
      primaryHover: '#0056b3',
      primaryActive: '#004085',
      primaryForeground: '#ffffff',
      
      // Secondary colors
      secondary: '#6c757d',
      secondaryHover: '#5a6268',
      secondaryActive: '#545b62',
      secondaryForeground: '#ffffff',
      
      // Backgrounds
      background: '#ffffff',
      backgroundAlt: '#f8f9fa',
      backgroundOverlay: 'rgba(0, 0, 0, 0.5)',
      
      // Text colors
      text: '#212529',
      textMuted: '#6c757d',
      textDisabled: '#adb5bd',
      textPlaceholder: '#6c757d',
      
      // UI colors
      border: '#dee2e6',
      borderFocus: '#80bdff',
      borderError: '#dc3545',
      
      // Feedback colors
      success: '#28a745',
      error: '#dc3545',
      warning: '#ffc107',
      info: '#17a2b8',
      
      // Interactive states
      hover: 'rgba(0, 123, 255, 0.1)',
      active: 'rgba(0, 123, 255, 0.2)',
      selected: 'rgba(0, 123, 255, 0.15)'
    },
    
    typography: {
      fonts: {
        heading: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
        body: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
        input: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
        button: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
        mono: 'SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace'
      },
      
      sizes: {
        // Question sizes
        questionXS: '16px',
        questionSM: '20px',
        questionMD: '24px',
        questionLG: '28px',
        questionXL: '32px',
        questionXXL: '40px',
        
        // Body text
        bodyXS: '12px',
        bodySM: '14px',
        bodyMD: '16px',
        bodyLG: '18px',
        
        // Input text
        inputSM: '14px',
        inputMD: '16px',
        inputLG: '18px',
        inputXL: '20px',
        
        // Button text
        buttonSM: '14px',
        buttonMD: '16px',
        buttonLG: '18px'
      },
      
      weights: {
        light: 300,
        regular: 400,
        medium: 500,
        semibold: 600,
        bold: 700
      },
      
      lineHeights: {
        tight: 1.2,
        normal: 1.5,
        relaxed: 1.75
      }
    },
    
    spacing: {
      questionSpacing: '48px',
      optionSpacing: '12px',
      sectionSpacing: '64px',
      
      paddingXS: '4px',
      paddingSM: '8px',
      paddingMD: '16px',
      paddingLG: '24px',
      paddingXL: '32px',
      paddingXXL: '48px'
    },
    
    borders: {
      widthThin: '1px',
      widthMedium: '2px',
      widthThick: '3px',
      
      radiusNone: '0',
      radiusSM: '4px',
      radiusMD: '8px',
      radiusLG: '12px',
      radiusXL: '16px',
      radiusFull: '9999px',
      
      inputRadius: '4px',
      buttonRadius: '4px',
      cardRadius: '8px'
    },
    
    effects: {
      shadowNone: 'none',
      shadowSM: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
      shadowMD: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
      shadowLG: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
      
      focusRing: '0 0 0 3px rgba(0, 123, 255, 0.25)',
      focusRingColor: 'rgba(0, 123, 255, 0.25)',
      focusRingWidth: '3px',
      
      blurSM: '4px',
      blurMD: '8px',
      blurLG: '16px',
      
      opacityDisabled: 0.6,
      opacityHover: 0.8
    },
    
    animations: {
      durationFast: '150ms',
      durationNormal: '200ms',
      durationSlow: '300ms',
      
      easingLinear: 'linear',
      easingIn: 'ease-in',
      easingOut: 'ease-out',
      easingInOut: 'ease-in-out',
      easingSpring: 'cubic-bezier(0.68, -0.55, 0.265, 1.55)',
      
      questionEnter: {
        duration: '300ms',
        easing: 'ease-out',
        delay: '0s',
        fill: 'forwards'
      },
      questionExit: {
        duration: '200ms',
        easing: 'ease-in',
        delay: '0s',
        fill: 'forwards'
      },
      optionStagger: '50ms',
      optionHover: {
        scale: 1.02,
        duration: '150ms'
      }
    },
    
    layout: {
      maxWidth: '720px',
      alignment: 'center',
      questionAlignment: 'left',
      optionLayout: 'vertical',
      progressPosition: 'top',
      progressStyle: 'bar'
    }
  },
  
  components: {
    textInput: {
      height: '48px',
      borderStyle: 'outline',
      focusStyle: {
        outline: '2px solid #007bff',
        borderColor: '#007bff'
      }
    },
    
    select: {
      optionHeight: '56px',
      optionBorderRadius: '8px',
      showNumbers: true,
      showLetters: true,
      numberStyle: 'circle'
    },
    
    rating: {
      iconType: 'star',
      iconSize: '32px',
      iconColor: '#dee2e6',
      iconColorActive: '#ffc107'
    },
    
    button: {
      primary: {
        background: '#007bff',
        backgroundHover: '#0056b3',
        backgroundActive: '#004085',
        text: '#ffffff',
        textHover: '#ffffff',
        border: 'none',
        borderHover: 'none',
        borderRadius: '4px',
        padding: '12px 24px',
        fontSize: '16px',
        fontWeight: 500,
        boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)'
      },
      secondary: {
        background: 'transparent',
        backgroundHover: '#f8f9fa',
        backgroundActive: '#e9ecef',
        text: '#007bff',
        textHover: '#0056b3',
        border: '1px solid #007bff',
        borderHover: '1px solid #0056b3',
        borderRadius: '4px',
        padding: '12px 24px',
        fontSize: '16px',
        fontWeight: 500
      }
    },
    
    fileUpload: {
      dropzoneHeight: '200px',
      dropzoneBorder: '2px dashed #dee2e6',
      dropzoneBackground: '#f8f9fa',
      iconSize: '48px'
    },
    
    datePicker: {
      calendarTheme: 'light',
      headerBackground: '#007bff',
      selectedDayBackground: '#007bff',
      todayBorderColor: '#007bff'
    },
    
    progress: {
      bar: {
        height: '4px',
        backgroundColor: '#e9ecef',
        fillColor: '#007bff',
        showPercentage: false
      },
      dots: {
        size: '8px',
        color: '#dee2e6',
        activeColor: '#007bff'
      }
    }
  },
  
  modes: {
    typeform: {
      background: {
        type: 'color',
        value: '#ffffff',
        overlay: 'transparent'
      },
      enableAnimations: true,
      animationIntensity: 'normal',
      showKeyboardHints: true,
      autoAdvance: false,
      autoAdvanceDelay: 750
    },
    
    chat: {
      containerBackground: '#f8f9fa',
      messageBubbles: {
        userBackground: '#007bff',
        aiBackground: '#e9ecef',
        borderRadius: '18px',
        spacing: '12px',
        maxWidth: '70%'
      },
      inputArea: {
        position: 'bottom',
        sendButtonStyle: 'icon'
      },
      avatars: {
        show: true,
        userAvatar: '',
        aiAvatar: ''
      },
      typingIndicator: {
        show: true,
        style: 'dots'
      }
    }
  },
  
  accessibility: {
    highContrast: {
      borderWidth: '2px',
      focusRingWidth: '4px',
      textWeight: 500
    },
    reducedMotion: {
      disableAnimations: false,
      instantTransitions: false
    },
    fontSizeMultiplier: 1,
    colorBlindMode: 'none'
  }
};