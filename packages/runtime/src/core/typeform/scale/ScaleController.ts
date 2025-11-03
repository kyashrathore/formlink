export function ratingSelectByDigit(
  d: number,
  min: number = 1,
  max: number = 5,
): { nextValue: number | null; autoAdvance: boolean } {
  if (Number.isNaN(d)) return { nextValue: null, autoAdvance: false };
  if (d < min || d > max) return { nextValue: null, autoAdvance: false };
  return { nextValue: d, autoAdvance: true };
}

export function linearSelectByDigit(
  d: number,
  start: number,
  end: number,
  step: number = 1,
): { nextValue: number | null; autoAdvance: boolean } {
  if (Number.isNaN(d)) return { nextValue: null, autoAdvance: false };
  const inRange =
    start <= end ? d >= start && d <= end : d <= start && d >= end;
  const aligns = (d - start) % step === 0;
  if (!inRange || !aligns) return { nextValue: null, autoAdvance: false };
  return { nextValue: d, autoAdvance: true };
}
