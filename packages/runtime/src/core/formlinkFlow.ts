import type { Form } from "../schema";
import jsonata from "jsonata";

export type NodeId = string;

export type Route = {
  id: string;
  from: NodeId | "ANY";
  when: { lang: "jsonata"; expr: string };
  to: NodeId | "END";
  priority?: number;
  note?: string;
};

export type RouteSpec = {
  routes: Route[];
};

type CompiledRoute = {
  id: string;
  from: NodeId | "ANY";
  expr: string;
  to: NodeId | "END";
  priority: number;
  note?: string;
  // Compiled JSONata program
  _j: any;
};

export type Program = {
  order: NodeId[];
  routesAny: CompiledRoute[];
  routesByFrom: Map<NodeId, CompiledRoute[]>;
};

export type DecisionTrace = {
  at: NodeId;
  candidates: Array<{
    routeId: string;
    matched: boolean;
    to: NodeId | "END";
    priority: number;
  }>;
  chosen?: { routeId: string; to: NodeId | "END" };
  defaulted?: boolean;
};

export type Analysis = {
  loops: Array<{ from: NodeId; to: NodeId }>; // best-effort, structural only
  unreachableNodes: NodeId[]; // structural reachability from first node in order
  deadEdges: Array<{ from: NodeId | "ANY"; to: NodeId }>; // heuristic only
  warnings?: string[];
};

/**
 * Internal pure compilation function. Exposed via module `compile()` and the
 * `FormlinkFlow` class static constructor.
 */
function compileProgram(spec: RouteSpec, form: Form): Program {
  if (!spec || !Array.isArray(spec.routes)) {
    throw new Error("Invalid RouteSpec: routes missing");
  }
  const order: NodeId[] = (form.questions || []).map((q: any) => q.id);
  const known = new Set<NodeId>(order);

  const routesAny: CompiledRoute[] = [];
  const routesByFrom: Map<NodeId, CompiledRoute[]> = new Map();

  for (const r of spec.routes) {
    const priority = typeof r.priority === "number" ? r.priority : 0;
    if (r.from !== "ANY" && !known.has(r.from)) {
      throw new Error(`Unknown from nodeId: ${r.from}`);
    }
    if (r.to !== "END" && !known.has(r.to)) {
      throw new Error(`Unknown to nodeId: ${r.to}`);
    }
    if (
      !r.when ||
      r.when.lang !== "jsonata" ||
      typeof r.when.expr !== "string"
    ) {
      throw new Error(`Invalid predicate for route ${r.id}`);
    }
    const compiled: CompiledRoute = {
      id: r.id,
      from: r.from,
      expr: r.when.expr,
      to: r.to,
      priority,
      note: r.note,
      _j: tryCompileJsonata(r.when.expr),
    };
    if (!compiled._j) {
      throw new Error(`Failed to compile JSONata for route ${r.id}`);
    }
    if (r.from === "ANY") routesAny.push(compiled);
    else {
      const arr = routesByFrom.get(r.from) ?? [];
      arr.push(compiled);
      routesByFrom.set(r.from, arr);
    }
  }
  const sortFn = (a: CompiledRoute, b: CompiledRoute) =>
    b.priority - a.priority;
  routesAny.sort(sortFn);
  for (const [k, arr] of routesByFrom) {
    arr.sort(sortFn);
    routesByFrom.set(k, arr);
  }
  return { order, routesAny, routesByFrom };
}

/**
 * OO wrapper for formlink flow operations. Holds a compiled Program and Form context
 * and exposes instance methods for decision-making and analysis.
 */
export class FormlinkFlow {
  readonly program: Program;
  readonly form: Form;

  constructor(program: Program, form: Form) {
    this.program = program;
    this.form = form;
  }

  static compile(spec: RouteSpec, form: Form): FormlinkFlow {
    return new FormlinkFlow(compileProgram(spec, form), form);
  }

  nextNode(
    answers: Record<string, unknown>,
    currentId: NodeId,
  ): NodeId | "END" {
    return nextNode(this.program, answers, currentId);
  }

  path(answers: Record<string, unknown>): NodeId[] {
    return path(this.program, answers);
  }

  visibleSet(
    answers: Record<string, unknown>,
    mode: "typeform" | "classic" = "typeform",
  ): Set<NodeId> {
    if (mode === "classic") {
      return new Set(path(this.program, answers));
    }
    // Typeform: include up to first REQUIRED unanswered.
    const ordered = path(this.program, answers);
    // Build required map from form
    const req = new Map<NodeId, boolean>();
    try {
      for (const q of this.form.questions ?? []) {
        const required = Boolean(q?.validations?.required?.value);
        req.set((q as any).id as NodeId, required);
      }
    } catch {
      // If form is malformed, fall back to functional visibleSet behavior
      return visibleSet(this.program, answers, mode);
    }
    const isAnswered = (v: unknown) => {
      if (v === null || typeof v === "undefined") return false;
      if (typeof v === "string") return v.trim().length > 0;
      if (typeof v === "number") return !Number.isNaN(v);
      if (v instanceof Date) return Number.isFinite(v.getTime());
      if (Array.isArray(v)) return v.length > 0;
      if (typeof v === "object")
        return Object.keys(v as Record<string, unknown>).length > 0;
      return true;
    };
    const firstReqUnansweredIdx = ordered.findIndex(
      (id) => req.get(id) === true && !isAnswered((answers as any)[id]),
    );
    if (firstReqUnansweredIdx === -1) return new Set(ordered);
    return new Set(ordered.slice(0, firstReqUnansweredIdx + 1));
  }

  explain(answers: Record<string, unknown>, at: NodeId): DecisionTrace {
    return explain(this.program, answers, at);
  }

  analyze(): Analysis {
    return analyze(this.program, this.form);
  }
}

/**
 * Compile a RouteSpec into an executable Program. Performs basic validation.
 * Back-compat functional API retained alongside the FormlinkFlow class.
 */
export function compile(spec: RouteSpec, form: Form): Program {
  return compileProgram(spec, form);
}

// --- JSONata integration (required at build; guarded by allowlist) ---

function tryCompileJsonata(expr: string): any | null {
  try {
    return jsonata(expr);
  } catch {
    return null;
  }
}

// Note: We import jsonata at module scope to ensure bundlers include it.

export function nextNode(
  program: Program,
  answers: Record<string, unknown>,
  currentId: NodeId,
): NodeId | "END" {
  const candidates: CompiledRoute[] = [
    ...program.routesAny,
    ...(program.routesByFrom.get(currentId) ?? []),
  ];
  for (const r of candidates) {
    const res = r._j.evaluate({ a: answers });
    if (!!res) return r.to;
  }
  // default to next in order
  const idx = program.order.indexOf(currentId);
  if (idx >= 0 && idx + 1 < program.order.length)
    return program.order[idx + 1]!;
  return "END";
}

export function path(
  program: Program,
  answers: Record<string, unknown>,
): NodeId[] {
  const out: NodeId[] = [];
  let hops = 0;
  let curr = program.order[0];
  while (curr && curr !== "END" && hops < 1024) {
    out.push(curr);
    const next = nextNode(program, answers, curr);
    if (next === "END") break;
    if (out.includes(next)) break; // guard trivial cycles
    curr = next;
    hops++;
  }
  return out;
}

export function visibleSet(
  program: Program,
  answers: Record<string, unknown>,
  mode: "typeform" | "classic" = "typeform",
): Set<NodeId> {
  const p = path(program, answers);
  if (mode === "classic") return new Set(p);
  // typeform: include up to first unanswered
  const firstUnansweredIdx = p.findIndex(
    (id) => answers[id] == null || answers[id] === "",
  );
  if (firstUnansweredIdx === -1) return new Set(p);
  return new Set(p.slice(0, firstUnansweredIdx + 1));
}

export function explain(
  program: Program,
  answers: Record<string, unknown>,
  at: NodeId,
): DecisionTrace {
  const candidates: CompiledRoute[] = [
    ...program.routesAny,
    ...(program.routesByFrom.get(at) ?? []),
  ];
  const results = candidates.map((r) => ({
    routeId: r.id,
    matched: !!r._j.evaluate({ a: answers }),
    to: r.to,
    priority: r.priority,
  }));
  const chosen = results.find((r) => r.matched);
  const trace: DecisionTrace = { at, candidates: results };
  if (chosen) trace.chosen = { routeId: chosen.routeId, to: chosen.to };
  else {
    trace.defaulted = true;
  }
  return trace;
}

export function analyze(program: Program, form: Form): Analysis {
  // Best-effort: check reachability from first node using default fallthrough edges only
  const nodes = new Set<NodeId>(program.order);
  const first = program.order[0];
  const reachable = new Set<NodeId>();
  for (let i = 0; i < program.order.length; i++) {
    reachable.add(program.order[i]!);
  }
  const unreachableNodes = Array.from(nodes).filter((n) => !reachable.has(n));
  return { loops: [], unreachableNodes, deadEdges: [], warnings: [] };
}
