import React from 'react';
import { motion } from 'motion/react';
import { BaseSelect, type BaseSelectProps } from '../../primitives/BaseSelect';
import { getChatAnimations } from '../shared/animations';
import { cn } from '../../../lib/utils';

export interface ChatSelectProps extends BaseSelectProps {
  onSubmit?: () => void;
  maxVisibleOptions?: number;
  className?: string;
  theme?: {
    chat?: {
      container?: string;
      button?: string;
      input?: string;
    };
  };
}

export function ChatSelect(props: ChatSelectProps) {
  const { 
    onSubmit, 
    maxVisibleOptions = 6,
    className,
    theme,
    ...baseProps 
  } = props;
  
  const base = BaseSelect({
    ...baseProps,
    autoSubmitOnChange: false, // Prevent auto-submission in Chat mode
    onSubmit // BaseSelect handles onSubmit internally
  });
  
  // Safe access with fallbacks
  const options = base.options || [];
  const [showAll, setShowAll] = React.useState(false);
  const visibleOptions = showAll ? options : options.slice(0, maxVisibleOptions);
  const hasMore = options.length > maxVisibleOptions && !showAll;
  
  const handleOptionClick = (optionValue: string | number) => {
    // Use selectOption which will call onChange internally
    // Note: selectOption already calls onSubmit internally
    base.selectOption(optionValue);
  };
  
  return (
    <div className={cn("space-y-3 focus:outline-none", theme?.chat?.container, className)}>
      {visibleOptions.map((option, index) => (
        <motion.button
          key={option.value}
          type="button"
          role="button"
          aria-pressed={option.isSelected}
          aria-disabled={option.disabled}
          disabled={option.disabled}
          {...getChatAnimations(index)}
          className={cn(
            "group flex items-center space-x-3 p-3 rounded-lg border-2 cursor-pointer transition-all duration-200 w-full text-left",
            "border-border/50 bg-card",
            "hover:border-primary/50 hover:bg-muted/50",
            option.isSelected && "border-primary bg-primary/10 hover:bg-primary/15 selected",
            option.disabled && "opacity-50 cursor-not-allowed hover:bg-card hover:border-border/50"
          )}
          onClick={() => !option.disabled && handleOptionClick(option.value)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowRight' && index < visibleOptions.length - 1) {
              e.preventDefault();
              // Use more specific selector to avoid conflicts
              const container = e.currentTarget.closest('.space-y-3');
              const buttons = Array.from(container?.querySelectorAll('button[role="button"]') || []) as HTMLButtonElement[];
              const nextButton = buttons[index + 1];
              if (nextButton) {
                nextButton.focus();
              }
            } else if (e.key === 'ArrowLeft' && index > 0) {
              e.preventDefault();
              const container = e.currentTarget.closest('.space-y-3');
              const buttons = Array.from(container?.querySelectorAll('button[role="button"]') || []) as HTMLButtonElement[];
              const prevButton = buttons[index - 1];
              if (prevButton) {
                prevButton.focus();
              }
            } else if (e.key === 'Enter') {
              e.preventDefault();
              handleOptionClick(option.value);
            }
          }}
        >
          <div
            className={cn(
              "w-5 h-5 rounded-full border-2 transition-all duration-200 flex items-center justify-center flex-shrink-0",
              "group-hover:scale-105",
              option.isSelected
                ? "bg-primary border-primary"
                : "border-input bg-transparent group-hover:border-primary/50"
            )}
          >
            {option.isSelected && (
              <motion.div 
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ duration: 0.15 }}
                className="w-2 h-2 bg-primary-foreground rounded-full" 
              />
            )}
          </div>
          <span className={cn("text-sm font-medium flex-1", option.disabled && "text-muted-foreground")}>
            {option.label}
          </span>
        </motion.button>
      ))}
      {hasMore && (
        <motion.button
          {...getChatAnimations(visibleOptions.length)}
          type="button"
          className={cn(
            "w-full flex items-center space-x-3 p-4 rounded-lg border-2 cursor-pointer transition-all duration-200",
            "border-dashed border-border bg-muted/30",
            "hover:border-primary hover:bg-muted/50",
            "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
          )}
          onClick={() => setShowAll(true)}
        >
          <div className="w-5 h-5 rounded-full border-2 border-dashed border-input/50 bg-transparent flex items-center justify-center flex-shrink-0" />
          <span className="text-sm font-medium flex-1 text-muted-foreground text-left">
            More options... ({options.length - maxVisibleOptions} more)
          </span>
        </motion.button>
      )}
    </div>
  );
}