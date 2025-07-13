import React, { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { ArrowDown, Type } from 'lucide-react';
import { cn } from '../../../lib/utils';
// ChatInputContainer deleted - this component may need refactoring
import type { BaseTextInputProps } from '../../primitives/BaseTextInput';

interface ChatTextInputImprovedProps extends BaseTextInputProps {
  showHint?: boolean;
  hintDelay?: number;
}

export const ChatTextInputImproved: React.FC<ChatTextInputImprovedProps> = ({
  label,
  placeholder = 'Type your answer below...',
  description,
  showHint = true,
  hintDelay = 1000,
  className,
  ...props
}) => {
  const [showArrowHint, setShowArrowHint] = React.useState(false);
  const hintTimerRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    if (showHint && !props.value) {
      hintTimerRef.current = setTimeout(() => {
        setShowArrowHint(true);
      }, hintDelay);
    } else {
      setShowArrowHint(false);
    }

    return () => {
      if (hintTimerRef.current) {
        clearTimeout(hintTimerRef.current);
      }
    };
  }, [showHint, props.value, hintDelay]);

  return (
    <ChatInputContainer className={cn('relative', className)}>
      <div className="space-y-6">
        {/* Question Display */}
        <div className="space-y-2">
          <h2 className="text-2xl font-semibold text-foreground">
            {label}
          </h2>
          {description && (
            <p className="text-base text-muted-foreground">
              {description}
            </p>
          )}
        </div>

        {/* Visual Hint Area */}
        <div className="relative">
          {/* Placeholder Input Visual */}
          <div className="rounded-lg border-2 border-dashed border-muted-foreground/30 bg-muted/30 px-4 py-3 transition-all duration-200 hover:border-muted-foreground/50">
            <div className="flex items-center gap-3 text-muted-foreground">
              <Type className="h-5 w-5" />
              <span className="text-base italic">{placeholder}</span>
            </div>
          </div>

          {/* Animated Arrow Hint */}
          {showArrowHint && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="absolute -bottom-12 left-1/2 -translate-x-1/2"
            >
              <motion.div
                animate={{
                  y: [0, 8, 0],
                }}
                transition={{
                  duration: 1.5,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
                className="flex flex-col items-center gap-2"
              >
                <ArrowDown className="h-6 w-6 text-primary" />
                <span className="text-sm font-medium text-primary whitespace-nowrap">
                  Type your answer here
                </span>
              </motion.div>
            </motion.div>
          )}
        </div>

        {/* Current Value Display (if any) */}
        {props.value && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-6"
          >
            <div className="rounded-lg bg-primary/5 border border-primary/20 px-4 py-3">
              <p className="text-sm text-muted-foreground mb-1">Your answer:</p>
              <p className="text-base text-foreground">{props.value}</p>
            </div>
          </motion.div>
        )}
      </div>
    </ChatInputContainer>
  );
};