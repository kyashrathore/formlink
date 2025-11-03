import {
  indexFromDigit,
  indexFromLetter,
  selectByIndex,
  toggleByIndex,
} from "../../typeform/choice/ChoiceController";

describe("ChoiceController", () => {
  test("index mapping", () => {
    expect(indexFromLetter("A")).toBe(0);
    expect(indexFromLetter("c")).toBe(2);
    expect(indexFromDigit("5")).toBe(4);
  });

  test("selectByIndex returns value and autoAdvance", () => {
    const options = [
      { value: "a" },
      { value: "b" },
      { value: "c", disabled: true },
    ];
    expect(selectByIndex(1, options)).toEqual({
      nextValue: "b",
      autoAdvance: true,
    });
    expect(selectByIndex(2, options)).toEqual({
      nextValue: null,
      autoAdvance: false,
    });
  });

  test("toggleByIndex toggles and preserves order from options", () => {
    const options = [{ value: "a" }, { value: "b" }, { value: "c" }];
    const cur: string[] = [];
    const t1 = toggleByIndex(1, options, cur).next; // add b
    expect(t1).toEqual(["b"]);
    const t2 = toggleByIndex(0, options, t1).next; // add a
    expect(t2).toEqual(["a", "b"]);
    const t3 = toggleByIndex(1, options, t2).next; // remove b
    expect(t3).toEqual(["a"]);
  });
});
