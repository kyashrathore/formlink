"use client";

import React from "react";
import { Button } from "@formlink/ui";
import { ArrowUp, ArrowDown } from "lucide-react";
import { motion } from "motion/react";

interface TypeFormNavigationProps {
  onPrevious?: () => void;
  onNext?: () => void;
  canGoPrevious?: boolean;
  canGoNext?: boolean;
}

export default function TypeFormNavigation({
  onPrevious,
  onNext,
  canGoPrevious = false,
  canGoNext = false,
}: TypeFormNavigationProps) {
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
        disabled={!canGoNext}
        className="h-12 w-12"
      >
        <ArrowDown className="h-5 w-5" />
      </Button>
    </motion.div>
  );
}