import { FormJunctionTheme } from '../types';

export const typeformTheme: FormJunctionTheme = {
  tokens: {
    colors: {
      // Primary brand colors - TypeForm's signature blue
      primary: '#262627',
      primaryHover: '#191919',
      primaryActive: '#000000',
      primaryForeground: '#ffffff',
      
      // Secondary colors
      secondary: '#5fb4e3',
      secondaryHover: '#4da3d7',
      secondaryActive: '#3b92cb',
      secondaryForeground: '#ffffff',
      
      // Backgrounds
      background: '#ffffff',
      backgroundAlt: '#f5f5f5',
      backgroundOverlay: 'rgba(0, 0, 0, 0.6)',
      
      // Text colors
      text: '#262627',
      textMuted: '#777777',
      textDisabled: '#bbbbbb',
      textPlaceholder: '#999999',
      
      // UI colors
      border: '#e3e3e3',
      borderFocus: '#262627',
      borderError: '#e15554',
      
      // Feedback colors
      success: '#4caf50',
      error: '#e15554',
      warning: '#ff9800',
      info: '#5fb4e3',
      
      // Interactive states
      hover: 'rgba(38, 38, 39, 0.05)',
      active: 'rgba(38, 38, 39, 0.1)',
      selected: 'rgba(95, 180, 227, 0.1)'
    },
    
    typography: {
      fonts: {
        heading: '"Apercu", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
        body: '"Apercu", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
        input: '"Apercu", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
        button: '"Apercu", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
        mono: '"Apercu Mono", SFMono-Regular, Menlo, Monaco, Consolas, monospace'
      },
      
      sizes: {
        // Question sizes - larger for TypeForm style
        questionXS: '20px',
        questionSM: '24px',
        questionMD: '32px',
        questionLG: '36px',
        questionXL: '40px',
        questionXXL: '48px',
        
        // Body text
        bodyXS: '14px',
        bodySM: '16px',
        bodyMD: '18px',
        bodyLG: '20px',
        
        // Input text - larger for better visibility
        inputSM: '18px',
        inputMD: '20px',
        inputLG: '24px',
        inputXL: '28px',
        
        // Button text
        buttonSM: '16px',
        buttonMD: '18px',
        buttonLG: '20px'
      },
      
      weights: {
        light: 300,
        regular: 400,
        medium: 500,
        semibold: 600,
        bold: 700
      },
      
      lineHeights: {
        tight: 1.3,
        normal: 1.6,
        relaxed: 1.8
      }
    },
    
    spacing: {
      questionSpacing: '80px',
      optionSpacing: '16px',
      sectionSpacing: '96px',
      
      paddingXS: '8px',
      paddingSM: '12px',
      paddingMD: '20px',
      paddingLG: '32px',
      paddingXL: '40px',
      paddingXXL: '64px'
    },
    
    borders: {
      widthThin: '1px',
      widthMedium: '2px',
      widthThick: '3px',
      
      radiusNone: '0',
      radiusSM: '3px',
      radiusMD: '6px',
      radiusLG: '8px',
      radiusXL: '12px',
      radiusFull: '9999px',
      
      inputRadius: '0',  // TypeForm uses no radius on inputs
      buttonRadius: '3px',
      cardRadius: '8px'
    },
    
    effects: {
      shadowNone: 'none',
      shadowSM: '0 2px 4px rgba(0, 0, 0, 0.08)',
      shadowMD: '0 4px 12px rgba(0, 0, 0, 0.12)',
      shadowLG: '0 8px 24px rgba(0, 0, 0, 0.16)',
      
      focusRing: '0 0 0 2px rgba(38, 38, 39, 0.2)',
      focusRingColor: 'rgba(38, 38, 39, 0.2)',
      focusRingWidth: '2px',
      
      blurSM: '4px',
      blurMD: '8px',
      blurLG: '16px',
      
      opacityDisabled: 0.4,
      opacityHover: 0.9
    },
    
    animations: {
      durationFast: '200ms',
      durationNormal: '300ms',
      durationSlow: '500ms',
      
      easingLinear: 'linear',
      easingIn: 'cubic-bezier(0.4, 0, 1, 1)',
      easingOut: 'cubic-bezier(0, 0, 0.2, 1)',
      easingInOut: 'cubic-bezier(0.4, 0, 0.2, 1)',
      easingSpring: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
      
      questionEnter: {
        duration: '400ms',
        easing: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
        delay: '0s',
        fill: 'forwards'
      },
      questionExit: {
        duration: '300ms',
        easing: 'cubic-bezier(0.4, 0, 1, 1)',
        delay: '0s',
        fill: 'forwards'
      },
      optionStagger: '80ms',
      optionHover: {
        scale: 1.03,
        duration: '200ms'
      }
    },
    
    layout: {
      maxWidth: '760px',
      alignment: 'center',
      questionAlignment: 'left',
      optionLayout: 'vertical',
      progressPosition: 'bottom',
      progressStyle: 'bar'
    }
  },
  
  components: {
    textInput: {
      height: '56px',
      borderStyle: 'underline',
      focusStyle: {
        borderColor: '#262627',
        backgroundColor: 'transparent'
      }
    },
    
    select: {
      optionHeight: '64px',
      optionBorderRadius: '0',
      showNumbers: true,
      showLetters: true,
      numberStyle: 'none'  // TypeForm shows inline hints
    },
    
    rating: {
      iconType: 'number',
      iconSize: '48px',
      iconColor: '#e3e3e3',
      iconColorActive: '#262627'
    },
    
    button: {
      primary: {
        background: '#262627',
        backgroundHover: '#191919',
        backgroundActive: '#000000',
        text: '#ffffff',
        textHover: '#ffffff',
        border: 'none',
        borderHover: 'none',
        borderRadius: '3px',
        padding: '16px 32px',
        fontSize: '18px',
        fontWeight: 500,
        boxShadow: 'none'
      },
      secondary: {
        background: 'transparent',
        backgroundHover: 'rgba(38, 38, 39, 0.05)',
        backgroundActive: 'rgba(38, 38, 39, 0.1)',
        text: '#262627',
        textHover: '#191919',
        border: '2px solid #262627',
        borderHover: '2px solid #191919',
        borderRadius: '3px',
        padding: '14px 30px',
        fontSize: '18px',
        fontWeight: 500
      }
    },
    
    fileUpload: {
      dropzoneHeight: '240px',
      dropzoneBorder: '2px dashed #e3e3e3',
      dropzoneBackground: '#fafafa',
      iconSize: '64px'
    },
    
    datePicker: {
      calendarTheme: 'light',
      headerBackground: '#262627',
      selectedDayBackground: '#262627',
      todayBorderColor: '#5fb4e3'
    },
    
    progress: {
      bar: {
        height: '2px',
        backgroundColor: '#e3e3e3',
        fillColor: '#262627',
        showPercentage: true
      },
      dots: {
        size: '10px',
        color: '#e3e3e3',
        activeColor: '#262627'
      }
    }
  },
  
  modes: {
    typeform: {
      background: {
        type: 'gradient',
        value: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        overlay: 'transparent'
      },
      enableAnimations: true,
      animationIntensity: 'playful',
      showKeyboardHints: true,
      autoAdvance: true,
      autoAdvanceDelay: 500
    },
    
    chat: {
      containerBackground: '#ffffff',
      messageBubbles: {
        userBackground: '#262627',
        aiBackground: '#f5f5f5',
        borderRadius: '20px',
        spacing: '16px',
        maxWidth: '75%'
      },
      inputArea: {
        position: 'floating',
        sendButtonStyle: 'both'
      },
      avatars: {
        show: false,
        userAvatar: '',
        aiAvatar: ''
      },
      typingIndicator: {
        show: true,
        style: 'pulse'
      }
    }
  },
  
  accessibility: {
    highContrast: {
      borderWidth: '3px',
      focusRingWidth: '4px',
      textWeight: 600
    },
    reducedMotion: {
      disableAnimations: false,
      instantTransitions: false
    },
    fontSizeMultiplier: 1,
    colorBlindMode: 'none'
  }
};