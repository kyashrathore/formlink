"use client";

import React from "react";
import { motion } from "motion/react";
import { cn } from "@/lib/utils";

interface TypeFormProgressProps {
  progress: number;
  current: number;
  total: number;
  className?: string;
}

export default function TypeFormProgress({ 
  progress, 
  current, 
  total, 
  className 
}: TypeFormProgressProps) {
  return (
    <div className={cn(
      "fixed top-0 left-0 right-0 z-50",
      className
    )}>
      {/* Progress bar */}
      <div className="h-1 bg-muted/20">
        <motion.div
          className="h-full bg-foreground"
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          transition={{ 
            type: "spring",
            stiffness: 400,
            damping: 40
          }}
        />
      </div>
      
      {/* Question counter */}
      <div className="absolute top-4 right-4 text-sm text-muted-foreground">
        {current} of {total}
      </div>
    </div>
  );
}