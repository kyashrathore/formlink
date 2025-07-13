import { Variants } from 'motion/react';

export interface AnimationConfig {
  initial?: Record<string, unknown>;
  animate?: Record<string, unknown>;
  exit?: Record<string, unknown>;
  transition?: Record<string, unknown>;
  whileHover?: Record<string, unknown>;
  whileTap?: Record<string, unknown>;
}

// TypeForm-style staggered animations for options
export function getTypeFormAnimations(index: number, disableHoverScale: boolean = false): AnimationConfig {
  const baseAnimation = {
    initial: { 
      opacity: 0, 
      x: -20,
      scale: 0.95 
    },
    animate: { 
      opacity: 1, 
      x: 0,
      scale: 1 
    },
    exit: { 
      opacity: 0, 
      x: 20,
      scale: 0.95 
    },
    transition: {
      duration: 0.3,
      delay: index * 0.05, // Stagger effect
      ease: [0.23, 1, 0.32, 1] // Smooth easing
    }
  };

  // Only add hover/tap animations for components that benefit from them
  if (!disableHoverScale) {
    return {
      ...baseAnimation,
      whileHover: {
        scale: 1.02,
        transition: { duration: 0.2 }
      },
      whileTap: {
        scale: 0.98
      }
    };
  }

  return baseAnimation;
}

// Question entrance animation
export const questionEnterAnimation: AnimationConfig = {
  initial: { 
    opacity: 0, 
    y: 20 
  },
  animate: { 
    opacity: 1, 
    y: 0 
  },
  transition: {
    duration: 0.5,
    ease: [0.23, 1, 0.32, 1]
  }
};

// Question exit animation
export const questionExitAnimation: AnimationConfig = {
  exit: { 
    opacity: 0, 
    y: -20 
  },
  transition: {
    duration: 0.3,
    ease: [0.23, 1, 0.32, 1]
  }
};

// Chat mode animations (more subtle)
export function getChatAnimations(index: number): AnimationConfig {
  return {
    initial: { 
      opacity: 0, 
      y: 10 
    },
    animate: { 
      opacity: 1, 
      y: 0 
    },
    transition: {
      duration: 0.2,
      delay: index * 0.03,
      ease: 'easeOut'
    }
  };
}

// Progress bar animation
export const progressBarAnimation: AnimationConfig = {
  initial: { scaleX: 0 },
  animate: { scaleX: 1 },
  transition: {
    duration: 0.3,
    ease: 'easeOut'
  }
};

// Selection animation
export const selectionAnimation: AnimationConfig = {
  initial: { scale: 0.8, opacity: 0 },
  animate: { scale: 1, opacity: 1 },
  exit: { scale: 0.8, opacity: 0 },
  transition: {
    duration: 0.2,
    ease: 'easeOut'
  }
};

// Fade animation
export const fadeAnimation: AnimationConfig = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
  transition: {
    duration: 0.2
  }
};

// Slide up animation
export const slideUpAnimation: AnimationConfig = {
  initial: { y: '100%', opacity: 0 },
  animate: { y: 0, opacity: 1 },
  exit: { y: '100%', opacity: 0 },
  transition: {
    duration: 0.3,
    ease: [0.23, 1, 0.32, 1]
  }
};

// Bounce animation for errors/validation
export const bounceAnimation: AnimationConfig = {
  animate: {
    x: [0, -10, 10, -10, 10, 0],
    transition: {
      duration: 0.5,
      ease: 'easeOut'
    }
  }
};

// Animation variants for different states
export const stateVariants: Variants = {
  idle: {
    scale: 1,
    opacity: 1
  },
  hover: {
    scale: 1.01, // Reduced from 1.02 for subtler effect
    transition: { duration: 0.2 }
  },
  pressed: {
    scale: 0.98,
    transition: { duration: 0.1 }
  },
  disabled: {
    opacity: 0.5,
    transition: { duration: 0.2 }
  }
};

// Utility to get animation intensity based on user preference
export function getAnimationIntensity(
  intensity: 'subtle' | 'normal' | 'playful' = 'normal'
): { duration: number; stagger: number; scale: number } {
  switch (intensity) {
    case 'subtle':
      return { duration: 0.2, stagger: 0.02, scale: 0.02 };
    case 'normal':
      return { duration: 0.3, stagger: 0.05, scale: 0.05 };
    case 'playful':
      return { duration: 0.5, stagger: 0.08, scale: 0.1 };
    default:
      return { duration: 0.3, stagger: 0.05, scale: 0.05 };
  }
}

// Reduced motion animations (for accessibility)
export function getReducedMotionAnimations(): AnimationConfig {
  return {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 },
    transition: { duration: 0.1 }
  };
}

// Check if user prefers reduced motion
export function shouldReduceMotion(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}