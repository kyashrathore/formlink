export type ChoiceOption<T = string> = { value: T; disabled?: boolean };

export function indexFromLetter(letter: string): number {
  return letter.toUpperCase().charCodeAt(0) - 65;
}

export function indexFromDigit(digit: string): number {
  return parseInt(digit, 10) - 1;
}

export function selectByIndex<T>(
  idx: number,
  options: ChoiceOption<T>[],
): { nextValue: T | null; autoAdvance: boolean } {
  if (idx < 0 || idx >= options.length)
    return { nextValue: null, autoAdvance: false };
  const opt = options[idx]!;
  if (opt.disabled) return { nextValue: null, autoAdvance: false };
  return { nextValue: opt.value, autoAdvance: true };
}

export function toggleByIndex<T>(
  idx: number,
  options: ChoiceOption<T>[],
  current: T[],
): { next: T[] } {
  if (idx < 0 || idx >= options.length) return { next: current };
  const opt = options[idx]!;
  if (opt.disabled) return { next: current };
  const set = new Set(current.map((v) => String(v)));
  const sv = String(opt.value);
  if (set.has(sv)) set.delete(sv);
  else set.add(sv);
  const next = options
    .filter((o) => set.has(String(o.value)))
    .map((o) => o.value as T);
  return { next };
}
