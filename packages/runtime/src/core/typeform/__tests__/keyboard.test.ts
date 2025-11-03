import {
  interpretKeyboard,
  type KeyboardContext,
} from "../../typeform/keyboard/KeyboardEngine";

function baseReq(
  overrides: Partial<Parameters<typeof interpretKeyboard>[0]> = {},
) {
  return {
    key: "",
    shiftKey: false,
    metaKey: false,
    ctrlKey: false,
    altKey: false,
    composing: false,
    defaultPrevented: false,
    overlayOpen: false,
    inEditable: false,
    scopeBailed: false,
    scopeActive: true,
    allowEnterInEditable: false,
    ...overrides,
  } as const;
}

describe("KeyboardEngine.interpretKeyboard", () => {
  test("letters map to singleChoice index and auto-advance", () => {
    const ctx: KeyboardContext = { family: "singleChoice", optionCount: 4 };
    const res = interpretKeyboard(baseReq({ key: "C" }), ctx);
    expect(res).toEqual({ type: "SelectIndex", index: 2, autoAdvance: true });
  });

  test("digits map to multipleChoice toggle", () => {
    const ctx: KeyboardContext = { family: "multipleChoice", optionCount: 5 };
    const res = interpretKeyboard(baseReq({ key: "2" }), ctx);
    expect(res).toEqual({ type: "ToggleIndex", index: 1 });
  });

  test("digits map to rating SetNumber with auto-advance", () => {
    const ctx: KeyboardContext = {
      family: "rating",
      rating: { min: 1, max: 5 },
    };
    const res = interpretKeyboard(baseReq({ key: "4" }), ctx);
    expect(res).toEqual({ type: "SetNumber", value: 4, autoAdvance: true });
  });

  test("linear scale respects start/end/step alignment", () => {
    const ctx: KeyboardContext = {
      family: "linearScale",
      linear: { start: 2, end: 8, step: 2 },
    };
    expect(interpretKeyboard(baseReq({ key: "3" }), ctx)).toEqual({
      type: "None",
    });
    expect(interpretKeyboard(baseReq({ key: "4" }), ctx)).toEqual({
      type: "SetNumber",
      value: 4,
      autoAdvance: true,
    });
  });

  test("Enter produces Continue intent", () => {
    const ctx: KeyboardContext = { family: "text" };
    const res = interpretKeyboard(baseReq({ key: "Enter" }), ctx);
    expect(res).toEqual({ type: "Continue" });
  });

  test("bails: overlay, editable (without allowEnter), defaultPrevented, modifiers, IME", () => {
    const ctx: KeyboardContext = { family: "singleChoice", optionCount: 3 };
    expect(
      interpretKeyboard(baseReq({ key: "A", overlayOpen: true }), ctx),
    ).toEqual({ type: "None" });
    expect(
      interpretKeyboard(baseReq({ key: "Enter", inEditable: true }), ctx),
    ).toEqual({ type: "None" });
    expect(
      interpretKeyboard(baseReq({ key: "Enter", defaultPrevented: true }), ctx),
    ).toEqual({ type: "None" });
    expect(
      interpretKeyboard(baseReq({ key: "A", metaKey: true }), ctx),
    ).toEqual({ type: "None" });
    expect(
      interpretKeyboard(baseReq({ key: "A", composing: true }), ctx),
    ).toEqual({ type: "None" });
  });

  test("editable enter allowed when allowEnterInEditable=true", () => {
    const ctx: KeyboardContext = { family: "date" };
    const res = interpretKeyboard(
      baseReq({ key: "Enter", inEditable: true, allowEnterInEditable: true }),
      ctx,
    );
    expect(res).toEqual({ type: "Continue" });
  });
});
