"use client";
import * as React from "react";

export type RankingOption<T = string> = { value: T; label: string };

export type UseRankingOptions<T = string> = {
  options: RankingOption<T>[];
  value: T[]; // ordered ranking; empty or subset allowed
  onChange: (next: T[]) => void;
};

export function useRanking<T = string>(opts: UseRankingOptions<T>) {
  const { options, value, onChange } = opts;

  const orderedValues = React.useMemo(() => {
    const base: T[] = value && value.length > 0 ? [...value] : [];
    for (const o of options) if (!base.includes(o.value)) base.push(o.value);
    return base;
  }, [value, options]);

  const ranksMap = React.useMemo<Map<T, number>>(() => {
    const m = new Map<T, number>();
    const arr = orderedValues as unknown as T[];
    for (let i = 0; i < arr.length; i++) {
      m.set(arr[i] as T, i + 1);
    }
    return m;
  }, [orderedValues]);

  const setRank = (optVal: T, rank: number) => {
    let currentList: T[] = (value && value.length > 0
      ? [...value]
      : options.map((o) => o.value)) as unknown as T[];
    if (rank === 0) {
      currentList = currentList.filter((v) => v !== optVal);
    } else {
      if (!currentList.includes(optVal)) currentList.push(optVal);
      currentList = currentList.filter((v, i, arr) => arr.indexOf(v) === i);
      const from = currentList.indexOf(optVal);
      const to = Math.max(0, Math.min(rank - 1, currentList.length - 1));
      if (from !== -1 && from !== to) {
        const copy = [...currentList] as T[];
        const item = copy.splice(from, 1)[0] as T;
        copy.splice(to, 0, item as T);
        currentList = copy;
      }
      for (const o of options)
        if (!currentList.includes(o.value as unknown as T))
          currentList.push(o.value as unknown as T);
    }
    onChange(currentList);
  };

  const moveUp = (optVal: T) => {
    const idx = orderedValues.findIndex((v) => Object.is(v, optVal));
    if (idx <= 0) return;
    setRank(optVal, idx); // idx is 1-based rank target (idx is 0-based)
  };
  const moveDown = (optVal: T) => {
    const idx = orderedValues.findIndex((v) => Object.is(v, optVal));
    if (idx === -1 || idx >= orderedValues.length - 1) return;
    setRank(optVal, idx + 2); // move to next rank
  };

  const onDragEnd = (activeVal: T, overVal: T | null) => {
    if (!overVal || Object.is(activeVal, overVal)) return;
    let currentList: T[] =
      value && value.length > 0
        ? ([...value] as unknown as T[])
        : (options.map((o) => o.value) as unknown as T[]);
    const from = (currentList as unknown as T[]).findIndex((v) =>
      Object.is(v, activeVal),
    );
    const to = (currentList as unknown as T[]).findIndex((v) =>
      Object.is(v, overVal as T),
    );
    if (from === -1 || to === -1) return;
    const copy = [...currentList] as T[];
    const item = copy.splice(from, 1)[0] as T;
    copy.splice(to, 0, item as T);
    for (const o of options)
      if (!copy.includes(o.value as unknown as T))
        copy.push(o.value as unknown as T);
    onChange(copy);
  };

  return {
    orderedValues,
    ranksMap,
    setRank,
    moveUp,
    moveDown,
    onDragEnd,
  } as const;
}
