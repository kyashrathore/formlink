"use client";

import React from "react";
import { Sparkles, Award, PartyPopper } from "lucide-react";

export function ConfettiElements() {
  return (
    <div className="absolute inset-0 pointer-events-none">
      <div className="absolute top-10 left-10 animate-bounce">
        <Sparkles className="w-8 h-8 text-primary" />
      </div>
      <div className="absolute top-12 right-14 animate-pulse">
        <PartyPopper className="w-8 h-8 text-primary" />
      </div>
      <div className="absolute bottom-32 left-12 animate-pulse">
        <Award className="w-8 h-8 text-primary" />
      </div>
      <div className="absolute bottom-40 right-10 animate-bounce">
        <Sparkles className="w-6 h-6 text-primary" />
      </div>
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 animate-ping">
        <PartyPopper className="w-10 h-10 text-primary" />
      </div>
    </div>
  );
}

export default ConfettiElements;