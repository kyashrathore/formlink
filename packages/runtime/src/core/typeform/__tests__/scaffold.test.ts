import {
  derive,
  direction,
  shouldAutoAdvance,
} from "../../typeform/scaffold/TypeformScaffoldCore";

const snapBase = {
  status: "filling",
  isSubmitting: false,
  progress: { index: 1, total: 5 },
  currentId: "q2",
  firstUnansweredId: "q2",
  values: { q1: "a" } as Record<string, unknown>,
  form: { id: "f", title: "t", description: "d", questions: [] },
  get value() {
    return undefined as unknown;
  },
  get visibleError() {
    return undefined as unknown;
  },
  get q() {
    return undefined as unknown;
  },
} as any;

const engineMock = {
  path: (vals: Record<string, unknown>) => ["q1", "q2", "q3"],
} as any;

describe("ScaffoldCore", () => {
  test("derive uses engine.path when available", () => {
    const r = derive(snapBase, engineMock);
    expect(r).toEqual({ qId: "q2", index: 1, total: 3 });
  });

  test("direction prefers navHint", () => {
    expect(direction(1, 2, -1)).toBe(-1);
    expect(direction(2, 1, null)).toBe(-1);
    expect(direction(1, 1, null)).toBe(1);
  });

  test("shouldAutoAdvance quick controls", () => {
    expect(shouldAutoAdvance("singleChoice", null, "x")).toBe(true);
    expect(shouldAutoAdvance("linearScale", 3, 3)).toBe(false);
    expect(shouldAutoAdvance("text", null, "hi")).toBe(false);
  });
});
