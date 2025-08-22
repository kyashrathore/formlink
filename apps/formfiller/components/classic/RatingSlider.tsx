"use client";

import { useState, useEffect } from "react";
import { cn } from "@formlink/ui/lib/utils";

interface RatingSliderProps {
  min: number;
  max: number;
  step?: number;
  minLabel?: string;
  maxLabel?: string;
  value: number;
  onChange: (value: number) => void;
  disabled?: boolean;
  iconType?: "star" | "heart" | "circle" | "numeric";
}

export default function RatingSlider({
  min,
  max,
  step = 1,
  minLabel,
  maxLabel,
  value,
  onChange,
  disabled = false,
  iconType = "star",
}: RatingSliderProps) {
  const [hoveredValue, setHoveredValue] = useState<number | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const numSteps = Math.floor((max - min) / step) + 1;

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  const renderIcon = (index: number) => {
    const ratingValue = min + index * step;
    const isActive = ratingValue <= (value || min);
    const isHovered = hoveredValue !== null && ratingValue <= hoveredValue;

    if (iconType === "numeric") {
      return (
        <span
          className={cn(
            "font-semibold transition-all duration-200",
            isMobile ? "text-lg" : "text-2xl",
            isActive ? "text-primary" : "text-muted-foreground/50",
            isHovered && !isActive && "text-primary/70",
          )}
        >
          {ratingValue}
        </span>
      );
    }

    const iconSize = isMobile ? "w-6 h-6" : "w-8 h-8";
    const colorClasses = cn(
      isActive ? "text-primary" : "text-muted-foreground/50",
      isHovered && !isActive && "text-primary/70",
    );

    const svgProps = {
      className: cn(iconSize, "transition-all duration-200", colorClasses),
      viewBox: "0 0 24 24",
      fill: isActive ? "currentColor" : "none",
      stroke: "currentColor",
      strokeWidth: "2",
    };

    switch (iconType) {
      case "star":
        return (
          <svg {...svgProps}>
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
          </svg>
        );
      case "heart":
        return (
          <svg {...svgProps}>
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
          </svg>
        );
      case "circle":
        return (
          <svg {...svgProps}>
            <circle cx="12" cy="12" r="10" />
          </svg>
        );
      default:
        return null;
    }
  };

  return (
    <div className="space-y-4">
      {/* Wrapper div to contain rating icons and labels */}
      <div>
        {/* Icon-based rating selector - matching unified pattern */}
        <div
          className={cn(
            "flex items-center justify-start",
            isMobile ? "gap-1" : "gap-3",
            numSteps > 7 && isMobile && "flex-wrap",
          )}
        >
          {Array.from({ length: numSteps }, (_, index) => {
            const ratingValue = min + index * step;
            return (
              <button
                key={index}
                type="button"
                className={cn(
                  "group rounded-lg transition-all duration-200",
                  isMobile ? "p-1" : "p-2",
                  "hover:bg-muted/50",
                  "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
                  disabled && "opacity-50 cursor-not-allowed",
                )}
                onClick={() => !disabled && onChange(ratingValue)}
                onMouseEnter={() => !disabled && setHoveredValue(ratingValue)}
                onMouseLeave={() => setHoveredValue(null)}
                disabled={disabled}
                aria-label={`Rate ${ratingValue} out of ${max}`}
              >
                <div className="group-hover:scale-110 transition-transform duration-200">
                  {renderIcon(index)}
                </div>
              </button>
            );
          })}
        </div>

        {/* Labels positioned under the rating icons */}
        {(minLabel || maxLabel) && (
          <div
            className="mt-2 flex items-center justify-between"
            style={{
              width: "100%",
              maxWidth: `calc(${numSteps} * ${isMobile ? "2rem" : "3.5rem"} + ${numSteps - 1} * ${isMobile ? "0.25rem" : "0.75rem"})`,
            }}
          >
            <span
              className={cn(
                "text-muted-foreground",
                isMobile ? "text-xs" : "text-sm",
              )}
            >
              {minLabel}
            </span>
            {value !== min && value !== max && (
              <span
                className={cn(
                  "font-medium text-foreground",
                  isMobile ? "text-xs" : "text-sm",
                )}
              >
                {value}
              </span>
            )}
            <span
              className={cn(
                "text-muted-foreground",
                isMobile ? "text-xs" : "text-sm",
              )}
            >
              {maxLabel}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
