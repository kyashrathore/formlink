import { useState, useEffect } from "react";

export function useRowLayout(
  optionsCount: number,
  threshold: number = 4
): boolean {
  const [shouldUseRowLayout, setShouldUseRowLayout] = useState(false);

  useEffect(() => {
    const isSmallOptionSet = optionsCount <= threshold;
    const isDesktopOrTablet = window.innerWidth >= 768;

    setShouldUseRowLayout(isSmallOptionSet && isDesktopOrTablet);

    const handleResize = () => {
      const isDesktopOrTablet = window.innerWidth >= 768;
      setShouldUseRowLayout(isSmallOptionSet && isDesktopOrTablet);
    };

    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, [optionsCount, threshold]);

  return shouldUseRowLayout;
}
