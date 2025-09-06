"use client";

import { useIsMobile } from "@/hooks/useIsMobile";
import { Button } from "@formlink/ui";
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Loader,
} from "lucide-react";
import { motion } from "motion/react";

interface TypeFormNavigationProps {
  onPrevious?: () => void;
  onNext?: () => void;
  canGoPrevious?: boolean;
  canGoNext?: boolean;
  isLoadingNext?: boolean;
}

export default function TypeFormNavigation({
  onPrevious,
  onNext,
  canGoPrevious = false,
  canGoNext = false,
  isLoadingNext = false,
}: TypeFormNavigationProps) {
  const isMobile = useIsMobile();

  if (isMobile) {
    // Mobile layout: full-width bottom navigation
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="fixed bottom-0 left-0 right-0 bg-background/95 backdrop-blur-sm border-t border-border p-4 safe-area-inset-bottom"
      >
        <div className="flex items-center gap-3 max-w-sm mx-auto">
          {/* Small back button on left */}
          <Button
            variant="outline"
            size="icon"
            onClick={onPrevious}
            disabled={!canGoPrevious}
            className="h-12 w-12 flex-shrink-0"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>

          {/* Large continue button taking remaining space */}
          <Button
            onClick={onNext}
            disabled={!canGoNext || isLoadingNext}
            size="lg"
            className="flex-1 h-12 group"
          >
            <span>Continue</span>
            {!isLoadingNext && (
              <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
            )}
            {isLoadingNext && <Loader size="sm" className="ml-2" />}
          </Button>
        </div>
      </motion.div>
    );
  }

  // Desktop layout: unchanged
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.5 }}
      className="fixed bottom-8 right-8 flex items-center gap-2"
    >
      <Button
        variant="outline"
        size="icon"
        onClick={onPrevious}
        disabled={!canGoPrevious}
        className="h-12 w-12"
      >
        <ArrowUp className="h-5 w-5" />
      </Button>

      <Button
        variant="outline"
        size="icon"
        onClick={onNext}
        disabled={!canGoNext || isLoadingNext}
        className="h-12 w-12"
      >
        <ArrowDown className="h-5 w-5" />
      </Button>
    </motion.div>
  );
}
