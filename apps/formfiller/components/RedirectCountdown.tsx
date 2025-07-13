"use client";

import React, { useState, useEffect } from "react";

type RedirectCountdownProps = {
  initialSeconds: number;
  redirectUrl: string;
  onCountdownComplete?: () => void;
};

export default function RedirectCountdown({
  initialSeconds,
  redirectUrl,
  onCountdownComplete,
}: RedirectCountdownProps) {
  const [currentSeconds, setCurrentSeconds] = useState(initialSeconds);

  useEffect(() => {
    if (!redirectUrl || currentSeconds <= 0) {
      if (currentSeconds <= 0) {
        onCountdownComplete?.();
      }
      return;
    }

    const timerId = setInterval(() => {
      setCurrentSeconds((prevSeconds) => {
        if (prevSeconds <= 1) {
          clearInterval(timerId);
          onCountdownComplete?.();
          return 0;
        }
        return prevSeconds - 1;
      });
    }, 1000);

    return () => clearInterval(timerId); // Cleanup on unmount or if props change
  }, [redirectUrl, onCountdownComplete, currentSeconds]); // Rerun if currentSeconds changes to handle external reset if needed

  // Reset if initialSeconds changes (e.g. parent wants to restart countdown)
  useEffect(() => {
    setCurrentSeconds(initialSeconds);
  }, [initialSeconds]);

  if (!redirectUrl || currentSeconds <= 0) {
    // If countdown is done or no URL, don't render (parent handles redirecting message)
    return null;
  }

  return (
    <div className="mt-4 font-semibold">
      Redirecting to {redirectUrl} in {currentSeconds} seconds...
    </div>
  );
}
