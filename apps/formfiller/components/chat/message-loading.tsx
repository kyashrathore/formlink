"use client";

import { Message } from "@formlink/ui";
import { cn } from "@/lib/utils";
import { motion } from "motion/react";

export function MessageLoading() {
  return (
    <Message
      className={cn(
        "group flex w-full max-w-3xl items-start gap-4 px-3 py-1.5 sm:px-4 md:px-6"
      )}
    >
      <motion.div 
        className="flex max-w-[90%] sm:max-w-[85%] md:max-w-[70%]"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
      >
        <div className="flex items-center space-x-1.5">
          <motion.div
            className="w-2 h-2 bg-muted-foreground/40 rounded-full"
            animate={{ opacity: [0.3, 1, 0.3] }}
            transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
          />
          <motion.div
            className="w-2 h-2 bg-muted-foreground/40 rounded-full"
            animate={{ opacity: [0.3, 1, 0.3] }}
            transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut", delay: 0.2 }}
          />
          <motion.div
            className="w-2 h-2 bg-muted-foreground/40 rounded-full"
            animate={{ opacity: [0.3, 1, 0.3] }}
            transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut", delay: 0.4 }}
          />
        </div>
      </motion.div>
    </Message>
  );
}