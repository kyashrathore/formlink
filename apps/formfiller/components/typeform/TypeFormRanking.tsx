"use client";

import type { QuestionResponse } from "@/lib/types";
import { UnifiedRanking } from "@formlink/ui";
import { useEffect, useState } from "react";

interface TypeFormRankingProps {
  options: Array<{ value: string; label: string }>;
  value: string[];
  onChange: (value: QuestionResponse) => void;
  onSubmit?: () => void;
  originalWasString?: boolean;
}

/**
 * TypeFormRanking
 * - Local wrapper to keep UI stable even if the parent updates are async or serializes values.
 * - Maintains a controlled local array, mirrors upstream when it changes,
 *   and emits JSON string when original response was a JSON string (symmetry).
 */
export default function TypeFormRanking({
  options,
  value,
  onChange,
  onSubmit,
  originalWasString = false,
}: TypeFormRankingProps) {
  const [local, setLocal] = useState<string[]>(
    Array.isArray(value) ? value : [],
  );

  // Keep in sync with upstream changes
  useEffect(() => {
    const upstream = Array.isArray(value) ? value : [];
    if (JSON.stringify(upstream) !== JSON.stringify(local)) {
      setLocal(upstream);
    }
  }, [value]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleChange = (arr: string[]) => {
    setLocal(arr);
    onChange(originalWasString ? JSON.stringify(arr) : arr);
  };

  return (
    <UnifiedRanking
      mode="typeform"
      options={options}
      value={local}
      onChange={handleChange}
      onSubmit={onSubmit}
    />
  );
}
