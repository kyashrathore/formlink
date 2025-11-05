# Branching Engine — Detailed Implementation Plan (v1)

Last updated: 2025-11-01

## Scope & Goals

- Unify branching as deterministic "next node" selection: no per-node conditions and no page primitives.
- AI-first authoring: natural language → compact route spec (JSON) using safe JSONata predicates.
- Deterministic runtime: no AI calls during filling; explainable, analyzable, and fast.
- Works for both one-by-one (Typeform) and multi-field (Classic) UIs.

## Final API (Consumption)

Runtime package surface (to be added under `packages/runtime/src/core/branching.ts`):

- `compile(spec: RouteSpec, form: Form): Program`
- `analyze(program: Program, form: Form): Analysis`
- `nextNode(program: Program, answers: Answers, currentId: NodeId): NodeId | "END"`
- `path(program: Program, answers: Answers): NodeId[]`
- `visibleSet(program: Program, answers: Answers, mode?: "typeform" | "classic"): Set<NodeId>`
- `explain(program: Program, answers: Answers, at: NodeId): DecisionTrace`

Typeform usage (one‑by‑one):

- Continue: validate `currentId`; then `next = nextNode(program, answers, currentId)`; if `next === "END"` submit; else set `currentId = next`.
- Back: use a visited stack inside the component; pop to move back.
- Progress: compute from `path(program, answers)` (index/total over reachable answerable nodes).

Classic usage (multi‑field):

- Progressive reveal: `visible = visibleSet(program, answers, "classic")`; render only nodes in `visible`.
- Optional paging: validate current page, pick a decision node (e.g., last answered in page), then `next = nextNode(program, answers, decisionNodeId)`; jump to page containing `next`.
- Progress: `answered / visible answerable` over `visibleSet`.

## Data & Types

- RouteSpec (AI output persisted at `form.settings.branching.spec`)
  - `routes: Route[]`
- Route
  - `id: string`
  - `from: NodeId | "ANY"` (flattened node id in layout)
  - `when: { lang: "jsonata", expr: string }`
  - `to: NodeId | "END"`
  - `priority?: number` (higher first)
  - `note?: string`
- Program (compiled)
  - `adj: Map<FromKey, CompiledRoute[]>` (sorted by priority desc, then author order)
  - `deps: Map<RouteId, Set<QuestionId>>` (JSONata AST var extraction)
  - `order: NodeId[]` (flattened layout order for default fallthrough)
  - `meta: { compilerVersion: string, warnings: string[] }`

JSONata allowlist:

- Context: `a = { [qId]: value }`
- Ops: `=, !=, <, <=, >, >=, in, not in`
- Funcs: `$lowercase, $contains, $length, $match (bounded), $number`
- Optional (feature‑gated): `$toMillis, between`
- Reject unknown identifiers/functions; bound regex size and evaluation time.

## Compile / Validate / Analyze

- `compile(spec, form)`
  - Validate schema/types.
  - Resolve `from`/`to` ids against form layout; forbid unknown ids.
  - Parse JSONata; enforce allowlist; extract dependencies per route.
  - Build adjacency (ANY + per-node) sorted by priority/author order.
  - Generate `order` from flattened layout.
- `analyze(program, form)`
  - Graph analysis under neutral answers:
    - Cycles (loops) → `loops: Edge[]`.
    - Unreachable nodes → `unreachableNodes: NodeId[]`.
    - Dead edges (heuristic) → `deadEdges: Edge[]`.
  - Return `Analysis` with `errors[]` / `warnings[]`.

## Evaluation Semantics

- `nextNode(program, answers, currentId)`
  - Candidates = `routes[ANY]` + `routes[currentId]` (pre-sorted).
  - Evaluate predicates in order; return first matching `to`.
  - Else default to the next sequential node in `program.order`.
  - If none → `END`.
  - Hop cap (e.g., 8) for chained hops; emits `branching:error` when exceeded.
- `path(program, answers)`
  - Start at the first node in order; repeatedly apply `nextNode()` until `END` or hop cap.
  - Returns the full reachable path.
- `visibleSet(program, answers)`
  - Typeform: path up to the current unanswered node.
  - Classic: configurable — default “progressive reveal” up to first unanswered; or entire path.
- Validation gate (UI level): never advance past invalid required nodes; validation wins over routing.

## Runtime Integration

- Add `packages/runtime/src/core/branching.ts` (compile/analyze/nextNode/path/visibleSet/explain + JSONata allowlist).
- Update `packages/runtime/src/core/selectors.ts`:
  - `visibleIds` from `visibleSet(program, answers)`.
  - `progress` from `path(program, answers)` (index/total/percent over answerable nodes).
- Update `packages/runtime/src/core/state.ts`:
  - Load/hold `program` in runtime context when form loads.
  - `set(qId, value)`: recompute visibility; if `currentId` becomes unreachable, reposition to nearest next reachable; emit `cursor:repositioned`.
  - `next()`: validate → `nextNode()` → submit on `END` or advance.
  - `prev()`: Typeform visited stack; Classic previous visible (if paging).
- Typeform (`packages/runtime/src/ui/react/TypeformTemplate.tsx`):
  - Continue calls engine-driven `next()`; Back uses visited stack.
  - Progress uses selectors; element screens are plain nodes (no special primitives).
- Classic (`packages/runtime/src/ui/react/ClassicTemplate.tsx`):
  - Filter render by `visibleSet()`; optional “Next Page” uses last-answered in page → `nextNode()` to jump.

## Devtools Simulation (`packages/runtime/src/devtools/Devtools.tsx`)

- Path pane: shows current node and full path; click a node to “jump” in sim.
- Decision trace: `explain(program, answers, at)` lists evaluated routes with boolean outcomes; highlights winner.
- Analyzer: show loops, unreachable nodes, and dead edges with links.
- Answer sliders: edit `answers[a.qId]` to see live path/trace changes.
- Export snapshot: spec + answers + path + current.

## Builder Integration (apps/formcraft)

- API routes:
  - POST `/api/forms/[formId]/branching/compile`
    - Input: `{ nl?: string, spec?: RouteSpec, form, options?: { preferJsonata?: true } }`
    - Output: `{ spec: RouteSpec, explanations: string[], tests: TestCase[], issues: Issue[] }`
  - PUT `/api/forms/[formId]/branching`
    - Persist `{ spec, meta }` after local compile+analyze pass.
  - GET `/api/forms/[formId]/branching/simulate?answers=…`
    - Returns `{ path, visibleSet, next, explain }`.
- Authoring flow:
  - Natural language → AI produces `RouteSpec` using a JSONata cookbook.
  - Local compile + analyze; run generated tests; manual edits allowed with lint.
  - Save only if green.

## Testing Strategy

- Unit (runtime): predicate truth tables; priority/order; ANY vs specific; loop/hop cap; unreachable; incremental recompute.
- Integration: Typeform continue/back; Classic progressive reveal and page jumps; validation gating; progress correctness.
- Performance: 200–500 node graphs; sub‑ms eval per change; record metrics.

## Security & Performance

- No RCE; safe JSONata allowlist only.
- Regex limits and predicate timeouts (e.g., 5ms each).
- Bound routes per node and total routes (e.g., 16 / 1000); documented and enforced.
- Hop cap to prevent pathological loops.

## Telemetry & Observability

- Events:
  - `branching:decide` { at, chosenRouteId, candidatesCount }
  - `branching:error` { reason: "hop_cap" | "invalid_to" | "unknown_node" }
  - `cursor:repositioned` { from, to, cause: "unreachable" }
- Sample to logs for production diagnosis.

## Limitations & Mitigations (v1)

This section details where the v1 engine intentionally does not support certain patterns, why they fail, and how to work around them with concrete examples.

### 1) Repeating/Dynamic Groups (arrays)

- Use case: “Add another dependent” creates dynamic instances `q_dependent_name[1..N]`. Route to the third dependent if age < 18.
- Why it fails: The engine routes between fixed nodeIds. Instance indices are not stable or known at compile time.
- Failure example:
  - Author tries `from: "q_dependent_age[2]"` → unknown nodeId; compile rejects.
- Mitigation (v1): Disallow instance-indexed ids; lint with a clear error.
- Workable pattern (v1): Route at the collection boundary, not per-instance. E.g., from `q_has_dependents` → to the first dependent block entry; iterate instances within the block without engine routing.
- V2 direction: Templated ids (e.g., `q_dependent_age[*]`) + runtime instance map so `from:"q_dependent_age[*]"` matches the active instance.

### 2) Async Predicates (API lookups)

- Use case: “If email belongs to a corporate domain (checked via API), go to enterprise onboarding.”
- Why it fails: Runtime evaluation must be synchronous; engine does not fetch.
- Failure example:
  - Predicate references an async outcome: `$isCorporate(a.q_email)` → unknown function; compile rejects.
- Mitigation (v1): Host pre-computes and injects a derived flag (e.g., `ctx.is_corporate = true|false`) before navigation. Predicate becomes `when: "$boolean(ctx.is_corporate) = true"`.
  - If `ctx` is missing, predicate evaluates false; route falls back to default.

### 3) A/B Randomized Branching

- Use case: 50/50 split between two flows; user must stick to assigned variant.
- Why it fails: Engine is deterministic and stateless; no random or side effects.
- Mitigation (v1): Assign `answers.variant = "A"|"B"` (or `ctx.variant`) once (server or app), persist with the session, and route on it:
  - `when: { expr: "a.variant = \"A\"" } → to: q_flowA_first`
  - `when: { expr: "a.variant = \"B\"" } → to: q_flowB_first`
- V2 direction: Built-in sticky assignment helper with hashing.

### 4) Localization Drift (label vs value)

- Use case: Choices are localized (“Deutschland” vs code “DE”). Authoring predicates against labels will break across locales.
- Failure example:
  - `when: "a.q_country = \"Germany\""` while value is `"DE"` → never matches.
- Mitigation (v1): Enforce option codes for predicates; compiler maps ambiguous labels→codes during authoring and lints if multiple options share a label.
  - Correct: `when: "a.q_country = \"DE\""`.

### 5) Reorder/Delete Drift

- Use case: Builder reorders or removes nodes after a spec was authored.
- Failure example:
  - `to: "q_state"` but `q_state` was deleted → compile rejects with `unknown to: q_state`.
  - Default “next in order” changes when layout reorders; expectations drift.
- Mitigation (v1):
  - Recompile on every structure change (save/publish gate).
  - Analyzer warns on unknown from/to, or unreachable nodes; block publish until resolved.

### 6) Progress Volatility

- Use case: Answering “No” prunes half the path; percent jumps from 20% → 60%.
- Why it happens: Progress is over the reachable path, which adapts to answers.
- Mitigation (v1):
  - Product copy clarifies adaptive progress (“of this path”).
  - Optional smoothing (UI only): show a short-lived transition rather than an immediate jump.

### 7) Multi‑Select Semantics

- Use case: Route if any/all selected options match a set.
- Failure example:
  - Author writes `a.q_multi = "A"` (treating array as string) → always false.
- Mitigation (v1): Provide JSONata helpers in the cookbook:
  - Any: `$some(a.q_multi, function($v){$v in ["A","B"]})`
  - All: `$reduce(["A","B"], true, function($acc,$x){$acc and ($x in a.q_multi)})`

### 8) File Upload & Derived Values

- Use case: Route if uploaded file is PDF and < 5MB.
- Failure mode: Predicate runs before upload descriptor exists; `a.q_file` is null.
- Mitigation (v1): Predicates should guard for presence and then check descriptor:
  - `when: "$length(a.q_file) > 0 and $lowercase(a.q_file.mime) = \"application/pdf\" and $number(a.q_file.size) < 5242880"`.
  - UI validates upload before continue; until then predicate is false and default route applies.

### 9) Back/Forward Consistency After Edits

- Use case: Editing earlier answers makes the current node unreachable.
- Behavior: Engine recompute can strand the cursor.
- Mitigation (v1):
  - On set(), if `currentId` becomes unreachable, reposition to the closest next reachable node and emit `cursor:repositioned`.
  - Visited stack (Typeform) is truncated to the last reachable entry.

### 10) Runtime Rule Drift (mid‑session updates)

- Use case: Builder publishes a new spec while users are mid‑flow.
- Risk: Program diverges from the one the session compiled; jumps feel wrong.
- Mitigation (v1): Freeze `program` for the session; only reload on hard reset/restart. Sessions pick up new specs on next entry.

## TanStack Form Arrays (v1) — Aggregate Repeater Pattern

TanStack Form’s arrays + dynamic/linked validation give us a powerful v1 story for repeaters without changing the engine.

### Pattern

- Treat a repeater as a single FFE node (an “aggregate step”).
- Keep per‑instance add/remove/reorder and validation inside TanStack Form.
- Gate Continue on aggregate validity. Derive simple flags (booleans/numbers/strings) for FFE routing.

### Typeform UI (one‑by‑one)

- Create a RepeaterStep component that renders a `<form.Field name="dependents" mode="array">` and per‑item subfields.
- Continue handler: `form.handleSubmit()` or explicit `form.validate()`; if valid, call FFE `next()`.

```tsx
// Pseudo: RepeaterStep.tsx
export function RepeaterStep({ nodeId }: { nodeId: string }) {
  const form = useFormContext();
  return (
    <form.Field name={nodeId} mode="array">
      {(field) => (
        <div>
          {field.state.value.map((_, i) => (
            <div key={i}>
              <form.Field name={`${nodeId}[${i}].name`}>
                {(f) => (
                  <input
                    value={f.state.value}
                    onChange={(e) => f.handleChange(e.target.value)}
                  />
                )}
              </form.Field>
              <form.Field name={`${nodeId}[${i}].age`}>
                {(f) => (
                  <input
                    type="number"
                    value={f.state.value}
                    onChange={(e) => f.handleChange(e.target.valueAsNumber)}
                  />
                )}
              </form.Field>
            </div>
          ))}
          <button
            type="button"
            onClick={() => field.pushValue({ name: "", age: 0 })}
          >
            Add dependent
          </button>
        </div>
      )}
    </form.Field>
  );
}
```

### Classic UI (multi‑field)

- Render the array inline within the page; use TanStack validation to gate the page’s Next/Submit.

### Dynamic/Linked validation

- Enable adaptive validation with `validationLogic: revalidateLogic()`.
- Use `onDynamic` to enforce aggregate constraints and compute derived flags for FFE routing (e.g., `answers.hasMinorDependent`).

```tsx
const form = useForm({
  defaultValues: { dependents: [], hasMinorDependent: false },
  validationLogic: revalidateLogic(),
  validators: {
    onDynamic: ({ value, fieldApi, formApi }) => {
      const deps = Array.isArray(value.dependents) ? value.dependents : [];
      const hasMinor = deps.some((p) => Number(p.age) < 18);
      formApi.setFieldValue("hasMinorDependent", hasMinor);
      if (deps.length === 0)
        return { dependents: "Add at least one dependent" };
      return undefined;
    },
  },
});
```

### Routing on derived flags (FFE)

```json
{
  "routes": [
    {
      "id": "r_minor",
      "from": "q_dependents",
      "when": { "lang": "jsonata", "expr": "a.hasMinorDependent = true" },
      "to": "q_guardianConsent"
    }
  ]
}
```

### Guardrails

- Do not route to specific instances (e.g., `[2]`) in v1; keep routing at aggregate level.
- Prune answers on remove (TanStack handles); ensure summaries recompute (use `onChangeListenTo` if needed).
- Normalize types (e.g., `Number(age)`) in validators to keep predicates simple.

## Path to v2 — Extending Beyond v1

This section outlines how to build dedicated systems that plug cleanly into the v1 Formflow Engine without compromising determinism.

### Collections Engine (Repeating Groups)

- Goal: Expand logical repeater blocks into instance‑specific nodeIds so each instance can be navigated/branched separately.
- Data model: `{ id: 'dep', min: 0, max: 5, children: ['q_dep_name','q_dep_age'] }` and an `instancesMap` `{ dep: [#1,#2,...] }`.
- Runtime API:
  - `CE.expandPath(ffeProgram, answers, instancesMap): NodeId[]` — returns an expanded path with `q_dep_name#1`, `q_dep_age#1`, …
  - `CE.addInstance(blockId) / CE.removeInstance(blockId, idx)` — updates `instancesMap` and prunes orphan answers.
- FFE integration: FFE still evaluates next on nodeIds; CE owns instance expansion before/after FFE calls.
- Builder tasks:
  - Repeater editor (min/max/default), drag/drop children.
  - Migration from v1 aggregate step: convert a single node to a repeater with CE managing instances.
- Analytics:
  - Store instance indices per answer; downstream can flatten to rows.

### Assignment Engine (Randomization: A/B, Monadic, BIBD)

- Goal: Deterministically assign a respondent to an arm/block with sticky identity and (optional) quotas.
- Data model: `Project { id, seed, arms: [{ id, weight|quota }], stickyKey: 'submissionId|userId' }`.
- Runtime API:
  - `AE.assign(project, stickyKey) -> { armId }` (pure)
  - Write `answers.variant = armId` before render.
- FFE use: Predicates route on `a.variant`.
- Builder tasks:
  - Experiments panel: arms, weights/quotas, sticky key; link arm → entry node.
  - Exposure log and live quota view.

### Seeded Shuffle (Options/Blocks)

- Goal: Reduce order bias by shuffling options or sections with a seed.
- Data:
  - `shuffle: true` flags on questions/sections; pin first/last where needed.
- Runtime:
  - `shuffle(seed, items)` applies at render; analytics record both presented and canonical order.
- FFE:
  - Default “next in order” uses the shuffled order; routing remains nodeId‑based.

### Derived Context Provider (Async/External Data)

- Goal: Compute `ctx.*` flags (geo, MX, entitlement) before FFE decisions without fetching in FFE.
- Contract:
  - `ctx = await deriveContext({ answers, headers, env })` with TTL and timeouts; inject into runtime context.
  - Predicates can read `ctx.*` alongside `a.*`.
- Builder:
  - Providers catalog with toggles and TTLs; test harness to preview ctx for sample inputs.

## Migration Strategy

- Legacy linear/journeyScript: provide adapter to emit trivial `RouteSpec`; optional sequential fallback behind flag only if no `spec` is present.

## Rollout Phases

1. Engine + types + validators (compile/analyze/nextNode/path/explain).
2. Runtime integration: selectors/state; Typeform navigation; Classic visible set.
3. Devtools: path + decision trace + analyzer.
4. Builder API + authoring: compile route, simulate/test, save.
5. Docs: authoring cookbook (JSONata), constraints, examples, troubleshooting.
6. Advanced extras: date helpers; optional decorate (class/attr), segments/macros.

## Example Route Spec

Goal: If `q_yesno` is Yes → jump into onboarding; else → eligibility; stop if no consent.

```json
{
  "routes": [
    {
      "id": "r_end_if_no_consent",
      "from": "ANY",
      "when": { "lang": "jsonata", "expr": "$lowercase(a.q_consent) = \"no\"" },
      "to": "END",
      "priority": 100,
      "note": "Finish early if no consent"
    },
    {
      "id": "r_yes",
      "from": "q_yesno",
      "when": { "lang": "jsonata", "expr": "a.q_yesno = \"Yes\"" },
      "to": "q_onboarding_first"
    },
    {
      "id": "r_no",
      "from": "q_yesno",
      "when": { "lang": "jsonata", "expr": "a.q_yesno = \"No\"" },
      "to": "q_eligibility_first"
    }
  ]
}
```

## Consumption Examples

Typeform (pseudo):

```ts
const program = compile(form.settings.branching.spec, form);
// Continue handler
const res = await runtime.actions.validate(currentId);
if (res.isValid) {
  const next = nextNode(program, runtime.context.answers, currentId);
  if (next === "END") await runtime.actions.submit();
  else setCurrentId(next);
}
```

Classic (pseudo):

```ts
const program = compile(form.settings.branching.spec, form);
const visible = visibleSet(program, answers, "classic");
// Next Page handler
const decisionNodeId = lastAnsweredNodeIdOnPage(pageId);
const next = nextNode(program, answers, decisionNodeId);
navigateToPageContaining(next);
```

### Direct RouteSpec Quickstart (no API)

For prototyping, embed a RouteSpec directly in the client and compile it at runtime. This skips any compile API — assume the spec was already authored by AI offline.

```ts
// 1) Define a minimal RouteSpec (from/when/to).
const spec: RouteSpec = {
  routes: [
    {
      id: "r_end_if_no_consent",
      from: "ANY",
      when: { lang: "jsonata", expr: '$lowercase(a.q_consent) = "no"' },
      to: "END",
      priority: 100,
    },
    {
      id: "r_yes",
      from: "q_yesno",
      when: { lang: "jsonata", expr: 'a.q_yesno = "Yes"' },
      to: "q_onboarding_first",
    },
    {
      id: "r_no",
      from: "q_yesno",
      when: { lang: "jsonata", expr: 'a.q_yesno = "No"' },
      to: "q_eligibility_first",
    },
  ],
};

// 2) Compile once when the form loads.
const program = compile(spec, form);

// 3) Use program in your navigation handlers.
async function onContinue() {
  const res = await runtime.actions.validate(currentId);
  if (!res.isValid) return;
  const next = nextNode(program, runtime.context.answers, currentId);
  if (next === "END") await runtime.actions.submit();
  else setCurrentId(next);
}

// 4) Progress and visibility derive from path/visibleSet.
const pathIds = path(program, runtime.context.answers);
const percent = Math.round(
  (pathIds.indexOf(currentId) / Math.max(pathIds.length, 1)) * 100,
);
```

## Actionable TODOs

- Add `branching.ts` with types and stubs in `packages/runtime/src/core/`.
- Wire selectors/state; expose `program` on runtime context.
- Update `UniversalTypeform` to call engine; add visited stack.
- Update `ClassicTemplate` to filter by `visibleSet`.
- Implement Devtools simulation panes.
- Add builder compile/simulate routes; write AI prompt with cookbook and constraints.
- Write unit tests for evaluation semantics, validators, and analyzer.
