import {
  getInitialIndex,
  nextIndex,
} from "../../typeform/focus/RovingFocusController";

describe("RovingFocusController", () => {
  test("getInitialIndex picks selected or 0", () => {
    expect(getInitialIndex(2, 5)).toBe(2);
    expect(getInitialIndex(-1, 5)).toBe(0);
  });

  test("nextIndex arrows wrap and skip disabled", () => {
    const isDisabled = (i: number) => i === 2 || i === 4;
    // Start at 1, ArrowRight should go to 3 (2 disabled)
    expect(
      nextIndex({ index: 1, key: "ArrowRight", itemCount: 5, isDisabled }),
    ).toBe(3);
    // From 3, ArrowRight should wrap to 0 (4 disabled)
    expect(
      nextIndex({ index: 3, key: "ArrowRight", itemCount: 5, isDisabled }),
    ).toBe(0);
    // Home -> first enabled (0)
    expect(nextIndex({ index: 3, key: "Home", itemCount: 5, isDisabled })).toBe(
      0,
    );
    // End -> last enabled (3)
    expect(nextIndex({ index: 0, key: "End", itemCount: 5, isDisabled })).toBe(
      3,
    );
  });
});
