// Temporary accessibility fixes for base primitives
// TODO: These should be fixed in the base primitives themselves

import type React from "react";

export function filterMultiSelectContainerProps(
  props: React.HTMLAttributes<HTMLElement>,
): React.HTMLAttributes<HTMLElement> {
  const { "aria-multiselectable": _omitted, ...filtered } = props || {};
  if (!("aria-label" in filtered)) {
    (filtered as Record<string, unknown>)["aria-label"] = "Select options";
  }
  return filtered;
}

export function filterRatingContainerProps(
  props: React.HTMLAttributes<HTMLElement>,
): React.HTMLAttributes<HTMLElement> {
  const {
    "aria-valuemin": _min,
    "aria-valuemax": _max,
    "aria-valuenow": _now,
    "aria-valuetext": _text,
    ...filtered
  } = props || {};
  return filtered;
}
