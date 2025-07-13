"use client";

import React from 'react';
import { motion } from 'motion/react';
import { BaseRating, type BaseRatingProps } from '../../primitives/BaseRating';
import { cn } from '../../../lib/utils';
import { Button } from '../../../ui/button';
import { ArrowRight } from 'lucide-react';
import { filterRatingContainerProps } from '../../primitives/patches/accessibility-fixes';
import { getTypeFormAnimations } from '../shared/animations';

export type FormMode = 'chat' | 'typeform';

export interface UnifiedRatingProps extends BaseRatingProps {
  mode: FormMode;
  iconType?: 'star' | 'heart' | 'circle';
  showLabels?: boolean;
  className?: string;
  type?: 'icon' | 'numeric' | 'emoji';
  icon?: string;
  showKeyboardHints?: boolean;
}

export function UnifiedRating({
  mode,
  iconType = 'star',
  showLabels = false,
  className,
  max = 5,
  onSubmit,
  type = 'icon',
  showKeyboardHints = true,
  ...baseProps
}: UnifiedRatingProps) {
  const base = BaseRating({ 
    ...baseProps, 
    max,
    // Mode-specific behavior: typeform auto-submits, chat requires manual submit
    autoSubmitOnChange: mode === 'typeform',
    onSubmit 
  });
  
  // const styles = mode === 'typeform' ? useThemeStyles('rating', 'typeform') : undefined;
  
  const handleRatingSelect = (rating: number) => {
    base.setRating(rating);
    // In typeform mode, this will auto-submit due to autoSubmitOnChange: true
    // In chat mode, user must click continue button
  };
  
  const handleContinue = () => {
    if (onSubmit) {
      onSubmit();
    }
  };
  
  const renderRatingContent = (index: number) => {
    const isActive = index < (base.value || 0);
    const isHovered = base.hoveredValue !== null && index < base.hoveredValue;
    
    // Chat mode supports multiple types, TypeForm mode only supports icons
    if (mode === 'chat' && type === 'numeric') {
      return (
        <span className={cn(
          "text-2xl font-semibold transition-all duration-200",
          isActive ? "text-primary" : "text-muted-foreground/50",
          isHovered && !isActive && "text-primary/70"
        )}>
          {index + 1}
        </span>
      );
    }
    
    if (mode === 'chat' && type === 'emoji') {
      const emojis = ['😡', '😕', '😐', '🙂', '😍'];
      const emojiLabels = ['Very dissatisfied', 'Dissatisfied', 'Neutral', 'Satisfied', 'Very satisfied'];
      return (
        <div className="flex flex-col items-center">
          <span className="text-3xl">{emojis[index] || emojis[emojis.length - 1]}</span>
          <span className="text-xs text-muted-foreground mt-1">{emojiLabels[index] || ''}</span>
        </div>
      );
    }
    
    // Icon rendering (unified for both modes)
    const iconSize = mode === 'chat' ? 'w-10 h-10' : 'w-12 h-12';
    
    // UNIFIED BEHAVIOR: Same color logic for both modes
    const colorClasses = cn(
      isActive ? "text-primary" : "text-muted-foreground/50",
      isHovered && !isActive && "text-primary/70"
    );
    
    const svgProps = {
      className: cn(iconSize, "transition-all duration-200", colorClasses),
      viewBox: "0 0 24 24",
      fill: isActive ? "currentColor" : "none",
      stroke: "currentColor",
      strokeWidth: "2"
    };
    
    switch (iconType) {
      case 'star':
        return (
          <svg {...svgProps}>
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
          </svg>
        );
      case 'heart':
        return (
          <svg {...svgProps}>
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
          </svg>
        );
      case 'circle':
        return (
          <svg {...svgProps}>
            <circle cx="12" cy="12" r="10" />
          </svg>
        );
      default:
        return null;
    }
  };
  
  const getLabel = (value: number) => {
    const labels = ['Poor', 'Fair', 'Good', 'Very Good', 'Excellent'];
    return labels[value - 1] || '';
  };

  const getAriaLabel = (index: number) => {
    if (mode === 'chat' && type === 'emoji') {
      return ['Very dissatisfied', 'Dissatisfied', 'Neutral', 'Satisfied', 'Very satisfied'][index] || `Rate ${index + 1} out of ${max}`;
    }
    if (mode === 'chat' && type === 'numeric') {
      return `${index + 1}`;
    }
    return `Rate ${index + 1} out of ${max}`;
  };

  if (mode === 'typeform') {
    // TypeForm layout and behavior
    return (
      <div className={cn("w-full max-w-2xl", className)} {...base.containerProps}>
        <div className="flex gap-4 justify-start">
          {base.items.map((item, index) => {
            // Extract only the necessary ARIA attributes without changing the role
            const { 'aria-checked': ariaChecked, 'aria-label': ariaLabel } = item.props;
            
            return (
              <motion.button
                key={item.value}
                type="button"
                {...getTypeFormAnimations(index, true)} // Disable motion scale, use CSS only
                className="relative p-2 transition-transform hover:scale-105 focus:outline-none focus:scale-105"
                onClick={() => handleRatingSelect(item.value)}
                onMouseEnter={() => base.setHoveredValue(item.value)}
                onMouseLeave={() => base.setHoveredValue(0)}
                aria-pressed={ariaChecked}
                aria-label={ariaLabel}
                tabIndex={base.value === item.value ? 0 : -1}
              >
                {renderRatingContent(index)}
                {showKeyboardHints && (
                  <kbd className="absolute -bottom-6 left-1/2 -translate-x-1/2 text-xs text-muted-foreground">{item.value}</kbd>
                )}
              </motion.button>
            );
          })}
        </div>
        {base.value > 0 && (
          <div className="mt-8 text-sm text-muted-foreground text-left">
            You selected: {base.value} / {max}
          </div>
        )}
      </div>
    );
  }

  // Chat layout and behavior
  return (
    <div
      {...filterRatingContainerProps(base.containerProps)}
      className={cn("focus:outline-none", className)}
    >
      <div className="flex items-center gap-3 justify-start">
        {Array.from({ length: max }, (_, index) => (
          <motion.button
            key={index}
            type="button"
            role="button"
            aria-label={getAriaLabel(index)}
            aria-pressed={base.value === index + 1}
            className={cn(
              "group p-2 rounded-lg transition-all duration-200",
              "hover:bg-muted/50",
              base.hoveredValue !== null && index + 1 <= base.hoveredValue && "hover",
              base.value === index + 1 && "selected",
              "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
            )}
            onClick={() => handleRatingSelect(index + 1)}
            onMouseEnter={() => base.setHoveredValue(index + 1)}
            onMouseLeave={() => base.setHoveredValue(null)}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: index * 0.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <div className="group-hover:scale-110 transition-transform duration-200">
              {renderRatingContent(index)}
            </div>
          </motion.button>
        ))}
      </div>
      
      {showLabels && base.value > 0 && (
        <div className="text-left mt-4 text-muted-foreground">
          {getLabel(base.value)} ({base.value} / {max})
        </div>
      )}
      
      {/* Continue Button - Only show in chat mode after interaction */}
      {onSubmit && base.value > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="flex items-center justify-start mt-6"
        >
          <Button 
            onClick={handleContinue}
            disabled={baseProps.disabled}
            size="lg" 
            className="group"
          >
            Continue
            <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
          </Button>
        </motion.div>
      )}
    </div>
  );
}