export type NextIndexInput = {
  index: number;
  key: string;
  itemCount: number;
  isDisabled?: (i: number) => boolean;
};

export function getInitialIndex(
  selectedIndex: number,
  itemCount: number,
): number {
  if (itemCount <= 0) return -1;
  if (selectedIndex >= 0 && selectedIndex < itemCount) return selectedIndex;
  return 0;
}

export function nextIndex({
  index,
  key,
  itemCount,
  isDisabled,
}: NextIndexInput): number {
  const last = Math.max(0, itemCount - 1);
  const disabled = isDisabled ?? (() => false);
  const step = (k: number) => (k < 0 ? last : k > last ? 0 : k);

  const advance = (start: number, delta: number) => {
    let i = start + delta;
    for (let tries = 0; tries < itemCount; tries++) {
      i = step(i);
      if (!disabled(i)) return i;
      i += delta;
    }
    return start; // fallback if all disabled
  };

  switch (key) {
    case "ArrowRight":
    case "ArrowDown":
      return advance(index, 1);
    case "ArrowLeft":
    case "ArrowUp":
      return advance(index, -1);
    case "Home":
      return advance(-1, 1);
    case "End":
      return advance(last + 1, -1);
    default:
      return index;
  }
}
