// Mock JSONata to be synchronous and deterministic for tests
// - Supports constants '1' and '0'
// - Supports simple variable lookups like 'a.key' -> ctx.a[key]
// - Throws on obvious malformed expressions like 'a[' to exercise compile-time error path
jest.mock("jsonata", () => {
  return (expr: string) => {
    if (expr.includes("[")) {
      throw new Error("compile error");
    }
    return {
      evaluate: (ctx: any) => {
        if (expr === "1") return 1;
        if (expr === "0") return 0;
        if (expr.startsWith("a.")) {
          const key = expr.slice(2).trim();
          return ctx?.a?.[key];
        }
        return undefined;
      },
    } as any;
  };
});

import { FormlinkFlow, type Route, type RouteSpec } from "@/core/formlinkFlow";
import type { Form } from "@/schema";

// ---------- Test Helpers ----------

function makeForm(questionIds: string[]): Form {
  // Minimal object satisfying what's needed by formlinkFlow (only uses questions[].id and order)
  const form = {
    id: "form_1",
    version_id: "v1",
    title: "Test",
    questions: questionIds.map((id, i) => ({ id, questionNo: i + 1 }) as any),
  } as unknown as Form;
  return form;
}

function makeSpec(routes: Route[]): RouteSpec {
  return { routes };
}

// Common test form
const FORM = makeForm(["q1", "q2", "q3", "q4"]);

describe("compile()", () => {
  test("throws when RouteSpec.routes missing", () => {
    const badSpec = {} as any;
    expect(() => FormlinkFlow.compile(badSpec, FORM)).toThrow(
      "Invalid RouteSpec: routes missing",
    );
  });

  test("throws on unknown from nodeId", () => {
    const spec = makeSpec([
      { id: "r1", from: "qx", when: { lang: "jsonata", expr: "1" }, to: "q1" },
    ]);
    expect(() => FormlinkFlow.compile(spec, FORM)).toThrow(
      "Unknown from nodeId: qx",
    );
  });

  test("throws on unknown to nodeId", () => {
    const spec = makeSpec([
      { id: "r1", from: "q1", when: { lang: "jsonata", expr: "1" }, to: "qx" },
    ]);
    expect(() => FormlinkFlow.compile(spec, FORM)).toThrow(
      "Unknown to nodeId: qx",
    );
  });

  test("throws on invalid predicate (lang not jsonata)", () => {
    const spec = makeSpec([
      {
        id: "r1",
        from: "q1",
        when: { lang: "not-jsonata" as any, expr: "1" },
        to: "q2",
      },
    ]);
    expect(() => FormlinkFlow.compile(spec, FORM)).toThrow(
      "Invalid predicate for route r1",
    );
  });

  test("throws when JSONata compilation fails", () => {
    const spec = makeSpec([
      { id: "r1", from: "q1", when: { lang: "jsonata", expr: "a[" }, to: "q2" },
    ]);
    expect(() => FormlinkFlow.compile(spec, FORM)).toThrow(
      "Failed to compile JSONata for route r1",
    );
  });

  test("sorts ANY and from-specific routes by descending priority", () => {
    const spec = makeSpec([
      {
        id: "a_low",
        from: "ANY",
        when: { lang: "jsonata", expr: "1" },
        to: "q3",
        priority: 5,
      },
      {
        id: "a_high",
        from: "ANY",
        when: { lang: "jsonata", expr: "1" },
        to: "q2",
        priority: 10,
      },
      {
        id: "f_low",
        from: "q1",
        when: { lang: "jsonata", expr: "1" },
        to: "q4",
        priority: 1,
      },
      {
        id: "f_high",
        from: "q1",
        when: { lang: "jsonata", expr: "1" },
        to: "q3",
        priority: 20,
      },
    ]);
    const engine = FormlinkFlow.compile(spec, FORM);
    expect(engine.program.order).toEqual(["q1", "q2", "q3", "q4"]);
    expect(engine.program.routesAny.map((r) => r.id)).toEqual([
      "a_high",
      "a_low",
    ]);
    expect(
      (engine.program.routesByFrom.get("q1") || []).map((r) => r.id),
    ).toEqual(["f_high", "f_low"]);
  });
});

describe("nextNode()", () => {
  test("falls back to next in order when no route matches", () => {
    const engine = FormlinkFlow.compile(makeSpec([]), FORM);
    const res = engine.nextNode({}, "q1");
    expect(res).toBe("q2");
  });

  test("returns END when at last node and no routes match", () => {
    const engine = FormlinkFlow.compile(makeSpec([]), FORM);
    const res = engine.nextNode({}, "q4");
    expect(res).toBe("END");
  });

  test("respects ANY routes precedence over from-specific", () => {
    const spec = makeSpec([
      // ANY matches first, regardless of from-specific presence
      {
        id: "any",
        from: "ANY",
        when: { lang: "jsonata", expr: "1" },
        to: "q3",
        priority: 1,
      },
      {
        id: "from_q1",
        from: "q1",
        when: { lang: "jsonata", expr: "1" },
        to: "q2",
        priority: 100,
      },
    ]);
    const engine = FormlinkFlow.compile(spec, FORM);
    const res = engine.nextNode({}, "q1");
    expect(res).toBe("q3");
  });

  test("among ANY routes, highest priority evaluated first", () => {
    const spec = makeSpec([
      {
        id: "any_low",
        from: "ANY",
        when: { lang: "jsonata", expr: "1" },
        to: "q2",
        priority: 1,
      },
      {
        id: "any_high",
        from: "ANY",
        when: { lang: "jsonata", expr: "1" },
        to: "q3",
        priority: 10,
      },
    ]);
    const engine = FormlinkFlow.compile(spec, FORM);
    const res = engine.nextNode({}, "q1");
    expect(res).toBe("q3");
  });

  test("can route directly to END", () => {
    const spec = makeSpec([
      {
        id: "finish",
        from: "q2",
        when: { lang: "jsonata", expr: "1" },
        to: "END",
      },
    ]);
    const engine = FormlinkFlow.compile(spec, FORM);
    const res = engine.nextNode({}, "q2");
    expect(res).toBe("END");
  });

  // Note: JSONata equality vs. truthiness can vary across engines; keep
  // conditions numeric boolean for deterministic behavior.
});

describe("path()", () => {
  test("simple fallthrough path equals form order", () => {
    const engine = FormlinkFlow.compile(makeSpec([]), FORM);
    const p = engine.path({});
    expect(p).toEqual(["q1", "q2", "q3", "q4"]);
  });

  test("respects routing and stops at END", () => {
    const spec = makeSpec([
      {
        id: "jump",
        from: "q1",
        when: { lang: "jsonata", expr: "1" },
        to: "q3",
      },
      {
        id: "finish",
        from: "q3",
        when: { lang: "jsonata", expr: "1" },
        to: "END",
      },
    ]);
    const engine = FormlinkFlow.compile(spec, FORM);
    const p = engine.path({});
    expect(p).toEqual(["q1", "q3"]);
  });

  test("guards against trivial cycles (breaks when next already visited)", () => {
    const spec = makeSpec([
      {
        id: "to_q3",
        from: "q1",
        when: { lang: "jsonata", expr: "1" },
        to: "q3",
      },
      {
        id: "back_to_q1",
        from: "q3",
        when: { lang: "jsonata", expr: "1" },
        to: "q1",
      },
    ]);
    const engine = FormlinkFlow.compile(spec, FORM);
    const p = engine.path({});
    expect(p).toEqual(["q1", "q3"]);
  });
});

describe("visibleSet()", () => {
  test("classic mode returns full path", () => {
    const engine = FormlinkFlow.compile(makeSpec([]), FORM);
    const vis = engine.visibleSet({}, "classic");
    expect(Array.from(vis)).toEqual(["q1", "q2", "q3", "q4"]);
  });

  test("typeform mode: up to first unanswered included", () => {
    const engine = FormlinkFlow.compile(makeSpec([]), FORM);
    const vis1 = engine.visibleSet({ q1: "a" }, "typeform");
    expect(Array.from(vis1)).toEqual(["q1", "q2"]);

    const vis2 = engine.visibleSet({ q1: "a", q2: "" }, "typeform");
    expect(Array.from(vis2)).toEqual(["q1", "q2"]);
  });

  test("typeform mode: all answered yields full path", () => {
    const engine = FormlinkFlow.compile(makeSpec([]), FORM);
    const vis = engine.visibleSet(
      { q1: "x", q2: 1, q3: true, q4: "ok" },
      "typeform",
    );
    expect(Array.from(vis)).toEqual(["q1", "q2", "q3", "q4"]);
  });
});

describe("explain()", () => {
  test("lists candidates and chosen when a route matches", () => {
    const spec = makeSpec([
      {
        id: "any",
        from: "ANY",
        when: { lang: "jsonata", expr: "1" },
        to: "q3",
        priority: 1,
      },
      {
        id: "from_q1",
        from: "q1",
        when: { lang: "jsonata", expr: "1" },
        to: "q2",
        priority: 100,
      },
    ]);
    const engine = FormlinkFlow.compile(spec, FORM);
    const trace = engine.explain({}, "q1");
    expect(trace.at).toBe("q1");
    expect(trace.candidates.length).toBe(2);
    expect(trace.candidates[0]).toMatchObject({
      routeId: "any",
      matched: true,
      to: "q3",
    });
    expect(trace.chosen).toEqual({ routeId: "any", to: "q3" });
    expect(trace.defaulted).toBeUndefined();
  });

  test("defaulted=true when no candidates match", () => {
    const engine = FormlinkFlow.compile(makeSpec([]), FORM);
    const trace = engine.explain({}, "q1");
    expect(trace.chosen).toBeUndefined();
    expect(trace.defaulted).toBe(true);
  });
});

describe("analyze()", () => {
  test("returns structural analysis with no unreachable nodes given current implementation", () => {
    const spec = makeSpec([
      { id: "r1", from: "q2", when: { lang: "jsonata", expr: "1" }, to: "q4" },
    ]);
    const engine = FormlinkFlow.compile(spec, FORM);
    const analysis = engine.analyze();
    expect(analysis.loops).toEqual([]);
    expect(analysis.unreachableNodes).toEqual([]);
    expect(analysis.deadEdges).toEqual([]);
    expect(analysis.warnings).toEqual([]);
  });
});

describe("complex branching and priorities", () => {
  const FORM2 = makeForm(["q1", "q2", "q3", "q4", "q5", "q6"]);

  test("multi-branch across nodes with ANY preemption", () => {
    const spec = makeSpec([
      // ANY: early finish if end_now
      {
        id: "any_end",
        from: "ANY",
        when: { lang: "jsonata", expr: "a.end_now" },
        to: "END",
        priority: 1000,
      },
      // from q1: choose jump to q3 if q1_is_1, else to q2 if q1_is_2
      {
        id: "q1_to_q3",
        from: "q1",
        when: { lang: "jsonata", expr: "a.q1_is_1" },
        to: "q3",
        priority: 10,
      },
      {
        id: "q1_to_q2",
        from: "q1",
        when: { lang: "jsonata", expr: "a.q1_is_2" },
        to: "q2",
        priority: 5,
      },
      // from q3: jump to q5 if q3_to_q5
      {
        id: "q3_to_q5",
        from: "q3",
        when: { lang: "jsonata", expr: "a.q3_to_q5" },
        to: "q5",
        priority: 1,
      },
      // from q4: jump to q6 if q2_to_q6
      {
        id: "q4_to_q6",
        from: "q4",
        when: { lang: "jsonata", expr: "a.q2_to_q6" },
        to: "q6",
        priority: 1,
      },
    ]);
    const engine = FormlinkFlow.compile(spec, FORM2);

    // Case A: q1=1 triggers q1->q3, q3=7 triggers q3->q5, then fallthrough to q6
    const pA = engine.path({ q1_is_1: 1, q3_to_q5: 1 });
    expect(pA).toEqual(["q1", "q3", "q5", "q6"]);

    // Case B: ANY preemption to END when q5=99
    const pB = engine.path({ end_now: 1 });
    expect(pB).toEqual(["q1"]);

    // Case C: q1=2 then q4_to_q6 based on q2=42
    const pC = engine.path({ q1_is_2: 1, q2_to_q6: 1 });
    expect(pC).toEqual(["q1", "q2", "q3", "q4", "q6"]);
  });
});

describe("cycles and loop guards", () => {
  const FORM3 = makeForm(["q1", "q2", "q3", "q4"]);

  test("2-node cycle is truncated by path guard", () => {
    const spec = makeSpec([
      {
        id: "q1_to_q2",
        from: "q1",
        when: { lang: "jsonata", expr: "a.loop" },
        to: "q2",
        priority: 10,
      },
      {
        id: "q2_to_q1",
        from: "q2",
        when: { lang: "jsonata", expr: "a.loop" },
        to: "q1",
        priority: 10,
      },
    ]);
    const engine = FormlinkFlow.compile(spec, FORM3);
    const p = engine.path({ loop: 1 });
    expect(p).toEqual(["q1", "q2"]);
  });

  test("3-node cycle truncates and breakout rule takes precedence when present", () => {
    const spec = makeSpec([
      {
        id: "q1_to_q2",
        from: "q1",
        when: { lang: "jsonata", expr: "a.loop" },
        to: "q2",
        priority: 10,
      },
      {
        id: "q2_to_q3",
        from: "q2",
        when: { lang: "jsonata", expr: "a.loop" },
        to: "q3",
        priority: 10,
      },
      // From q3: breakout to q4 when break=1, else continue cycle to q1
      {
        id: "q3_break_to_q4",
        from: "q3",
        when: { lang: "jsonata", expr: "a.break" },
        to: "q4",
        priority: 50,
      },
      {
        id: "q3_to_q1",
        from: "q3",
        when: { lang: "jsonata", expr: "a.loop" },
        to: "q1",
        priority: 10,
      },
    ]);
    const engine = FormlinkFlow.compile(spec, FORM3);

    const pCycle = engine.path({ loop: 1, break: 0 });
    expect(pCycle).toEqual(["q1", "q2", "q3"]);

    const pBreak = engine.path({ loop: 1, break: 1 });
    expect(pBreak).toEqual(["q1", "q2", "q3", "q4"]);

    // Explain at q3 should pick breakout when break=1
    const t = engine.explain({ loop: 1, break: 1 }, "q3");
    expect(t.chosen).toEqual({ routeId: "q3_break_to_q4", to: "q4" });
  });
});

describe("back-and-forth navigation with answer changes", () => {
  const FORM4 = makeForm(["q1", "q2", "q3"]);

  test("go back from q2 to q1, change answer, then proceed forward", () => {
    const spec = makeSpec([
      // If flip=1, q2 sends you back to q1
      {
        id: "q2_back_q1",
        from: "q2",
        when: { lang: "jsonata", expr: "a.flip" },
        to: "q1",
        priority: 10,
      },
      // If complete=1, q2 jumps to q3
      {
        id: "q2_to_q3",
        from: "q2",
        when: { lang: "jsonata", expr: "a.complete" },
        to: "q3",
        priority: 5,
      },
    ]);
    const engine = FormlinkFlow.compile(spec, FORM4);

    // Start with flip=1 (forces back from q2 to q1)
    let answers = { flip: 1 } as Record<string, unknown>;
    const n1 = engine.nextNode(answers, "q1"); // fallthrough to q2
    expect(n1).toBe("q2");
    const n2 = engine.nextNode(answers, "q2"); // go back to q1
    expect(n2).toBe("q1");

    // Change: flip=0, complete=1 to move forward
    answers = { flip: 0, complete: 1 };
    const n3 = engine.nextNode(answers, "q1"); // to q2 (fallthrough)
    expect(n3).toBe("q2");
    const n4 = engine.nextNode(answers, "q2"); // now jump to q3
    expect(n4).toBe("q3");

    // Entire path snapshots per state
    const pBack = engine.path({ flip: 1 });
    expect(pBack).toEqual(["q1", "q2"]); // truncated due to back-edge cycle
    const pForward = engine.path({ flip: 0, complete: 1 });
    expect(pForward).toEqual(["q1", "q2", "q3"]);
  });
});
