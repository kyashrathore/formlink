# Advanced Analytics & Form Design – Detailed Technical Blueprint (v3)

_Last updated: 2025-09-19_

## 1. Vision & Goals

- Transform Formlink into an AI-native research platform that handles advanced survey design (Conjoint/CBC, MaxDiff, TURF, Segmentation, Driver/Pricing studies) without requiring manual scripting.
- Maintain a single Next.js + Supabase stack; avoid new Python/Flask services while delivering analytics that traditionally require specialist tooling.
- Ship first-class respondent-quality scoring via an AI prompt that runs automatically at submission time and attaches flags to responses.
- Guarantee parity across respondent experiences (Typeform, Chat, Classic beta) by keeping AI branching as the navigation engine with consistent helpers across modes.
- Provide creators with guided, explainable workflows—from natural-language setup through launch, monitoring, analytics, and distribution.

## 2. Core Personas & Flows

### 2.1 Creator (Research Programmer / Manager)

1. **Intent Capture**
   - Creator opens Formcraft and describes the study in plain language (e.g., “CBC on 4 attributes, 300 completes, US Gen-Z”).
   - AI study wizard parses intent, proposes methodology, sample plan, quotas.
2. **Design & Configuration**
   - Creator uses Power Mode panels to configure attributes/levels (Conjoint), item pools (MaxDiff), or TURF candidates.
   - Visual builder for AI branching rules + randomization; preview simulators show expected flows in Typeform/Chat/Classic.
3. **Validation**
   - Design compiler runs checks: design efficiency, forbidden combos met, quotas consistent, assets resolved.
   - Warnings with AI “fix-it” suggestions if rules break (e.g., dominant profile detected).
4. **Launch & Field**
   - Creator publishes form; optional panel orchestrator handles supplier redirects and quotas.
   - Dashboard shows real-time quality metrics and sample fill by cell.
5. **Analysis & Reporting**
   - After field, creator asks RI for insights (“simulate share if we price at $899”).
   - System returns utilities, TURF combos, segment personas, driver priorities, and quality-adjusted filters.
   - One-click exports (Slides, Sheets) include narratives & recommended actions.

### 2.2 Respondent (Any Mode)

1. Receives the survey in the assigned mode (Typeform, Chat, Classic).
2. Navigation honours AI branching triggered via `mightBranchOffNext`, ensuring the same logic applies in Typeform, Chat, and Classic beta.
3. Upon completion, submission is saved and quality scoring is performed immediately as part of the submission process.
4. Respondent experience ends in usual completion screen (Typeform/Classic) or assistant message (Chat).

### 2.3 Operations & Analytics Flow

1. **Submission Save & Quality Score** → `/api/forms/{formId}/answers` (existing endpoint). The backend immediately calls an AI prompt that evaluates speed, straightlining, geo/IP, and open-end quality; results are stored alongside the submission.
2. **Responses API Call** → existing `/api/responses` now left-joins sidecars and dispatches advanced analytics modules based on RI plan `insights_spec`.
3. **RI Agent** → returns enhanced plans referencing new insight types; frontend renders specialized cards & filters.
4. **Exports** → optional weighting & simulation modules reuse analytics outputs for PowerPoint/Sheets templates.

## 3. Form Design Capabilities (Detailed)

### 3.1 Intent-Based Branching (AI Journey Script)

- **Creator Experience**: Authors write rich natural-language rules inside the journey script (e.g., “After Q4, if Brand = B or Age < 35, jump respondents into the premium bundle block; otherwise continue to Q5”). The Power Mode panel visualises each condition, flags unanswered cases, and lets the creator run mode-specific previews to see how AI will route respondents.
- **Runtime & Rendering**: The `mightBranchOffNext` flag on a question is the trigger. When a respondent answers a question with this flag, the frontend calls the `/api/ai/branching` endpoint to determine the next question. There is no change to how the question itself is rendered; the flag only affects the navigation logic after the question is answered.

### 3.2 Randomization & Rotations

- **Creator Experience**: For any block or question, creators toggle “Randomize” and pick scope (shuffle answer options vs. entire question sets), seed strategy (`submission` or `panel`), optional weights, and block size (for rotations). Preview shows sample respondent paths to demonstrate balance.
- **Schema Field**: `settings.randomization?: { scope: "options" | "questions", targetQuestionIds?: string[], seedStrategy: "submission" | "panel", weights?: number[], blockSize?: number }`. This is defined at the form level.
- **Runtime & Rendering**: This setting is checked by the frontend rendering engine before displaying questions.
  - If `scope` is `"questions"`, the main form component uses a `seededShuffle` utility to reorder the list of questions (or a subset, if `targetQuestionIds` is provided) before rendering them. This happens once per respondent based on the `seedStrategy`.
  - If `scope` is `"options"`, the component responsible for rendering a specific question (e.g., a multiple-choice question) will check if its ID is included in `targetQuestionIds`. If so, it will use the `seededShuffle` utility to randomize the order of its answer options before rendering them.
  - This logic is invisible to the respondent, who simply sees a shuffled order of questions or options.

### 3.3 Conjoint Template (CBC / ACBC)

- **Creator Flow**: Authors tag a group of questions that constitute a Conjoint exercise. The analysis relies on the creator structuring these questions correctly (e.g., one question per task). Branching logic can be used to show the right sequence of questions.
- **Schema**: `settings.methodology.conjoint = { questionTags: string[] }`. Questions are tagged with a common identifier (e.g., `conjoint_task_1`).
- **Runtime & Rendering**: The `settings.methodology.conjoint` field has **no direct impact on rendering**. The questions identified by the tags are rendered as standard question types (e.g., multiple choice). The respondent experience is a sequence of normal questions, with the flow controlled by AI branching. The tags are used purely by the backend analytics module to identify and analyze the data as a Conjoint study after the submission is complete.

### 3.4 MaxDiff Template

- **Creator Flow**: Authors paste up to 40 items; the tool deduplicates and groups similar wording. Balanced task schedules are generated automatically, with options to adjust items per task or add anchors.
- **Schema**: `question.analysis.maxdiff = { items: [{ id, label }...], tasks: [{ id, itemIds: string[] }], anchors?: { bestId?, worstId? } }`.
- **Runtime & Rendering**: The presence of the `question.analysis.maxdiff` field instructs the frontend to render a specialized **MaxDiff component** instead of a standard question type.
  - This component manages an internal state to track the current task.
  - For each task, it uses the `itemIds` to look up the item labels from the `items` array.
  - It then renders the list of items for the current task, along with two sets of inputs (e.g., radio buttons or clickable cards) labeled "Most" and "Least".
  - When the respondent makes their selection and proceeds, the component records the choice and displays the next task in the sequence. This continues until all tasks are completed.

### 3.5 TURF Setup

- **Creator Flow**: Creators choose candidate items (SKUs, messages) and define constraints (must-have, cost cap, mutual exclusion). They specify the response fields that represent preference (single choice, multi-select, MaxDiff scores).
- **Schema**: `settings.methodology.turf = { candidateIds: string[], constraints: Constraint[], scoringSource: { questionId: string, interpretation: "binary" | "scale" } }`.
- **Runtime & Rendering**: This schema field is for analytics only and has **no direct impact on rendering**. The questions that serve as the `scoringSource` are rendered as standard question types (e.g., multiple choice). The TURF settings are used by the backend analytics module to run the optimization after data has been collected.

### 3.6 Segmentation & Driver Configuration

- **Creator Flow**: In Power Mode, creators select clustering variables (attitude scales, behaviours) and choose the outcome + predictors for driver analysis. They set preprocessing (z-score/min-max) and optional maximum clusters (`maxK`).
- **Schema**: Extend settings with `methodology.segmentation = { driverQuestionIds: string[], scaling: "zscore" | "minmax", maxK?: number }` and `methodology.driver = { outcomeQuestionId: string, predictorIds: string[], method: "ridge" | "lasso" }`.
- **Runtime & Rendering**: These schema fields are for analytics only and have **no direct impact on rendering**. The questions identified by `driverQuestionIds`, `outcomeQuestionId`, and `predictorIds` are all rendered as standard question types. This metadata is used exclusively by the backend analytics modules.

### 3.7 Multi-form Study Linkage

- **Creator Flow**: Wizard links related forms for monadic or sequential tests. Creators define a shared correlation ID and assign cell IDs per form; optional allocation targets ensure balanced traffic.
- **Schema**: `settings.studyLinkage = { correlationId: string, linkedForms: [{ formId: string, cellId: string }], allocation?: { strategy: "balanced" | "quota", targets?: Record<string, number> } }`.
- **Runtime & Rendering**: This schema has **no direct impact on question rendering**. It is used at a higher level to route respondents to the correct form and to link submission data on the backend for cross-cell analysis.

-**Authoring Enhancements Shared Across Capabilities**

- Study Wizard (NL → design, tasks, sample plan, quotas, LOI estimate).
- Design QA dashboard with efficiency scores, constraint checks, randomization diagnostics.
- `settings.schemaVersion` stamp to track migrations and upgrades over time.

## 4. Current Schema vs Required Extensions

| Area            | Current Support (`packages/schema/src/index.ts`)                       | Gap                                                                   | Extension Needed                                                                                        |
| --------------- | ---------------------------------------------------------------------- | --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Questions       | Basic types, validations.                                              | No metadata for some analysis types.                                  | Add optional `analysis` field for specific question-level methodologies like MaxDiff.                   |
| Form Settings   | `additionalFields`, `journeyScript`, `branching.enabled`.              | No methodology catalog, study linkage, weighting info, randomization. | Append `settings.methodology`, `settings.studyLinkage`, `settings.weighting`, `settings.randomization`. |
| Responses DB    | Tables: `form_submissions`, `form_answers`.                            | No quality scores or advanced analysis caches.                        | Quality scores stored with submission, optional analytics caches (e.g., `ri_ai_cache` already exists).  |
| Runtime Logic   | `shouldShowQuestion` returns true; Typeform/Chat rely on AI branching. | Need shared helper so all modes call the same AI endpoint.            | Add shared branching helper across modes.                                                               |
| Analytics Layer | Counts, trends, breakdowns, simple metrics.                            | Missing Conjoint/MaxDiff/TURF/segmentation/driver/Pricing modules.    | Extend responses API with analytics helpers + new RI insight types.                                     |

### 4.1 Schema Additions (TypeScript Sketch)

```ts
// packages/schema/src/index.ts
export const RandomizationSchema = z.object({
  scope: z.enum(["options", "questions"]),
  targetQuestionIds: z.array(z.string()).optional(),
  seedStrategy: z.enum(["submission", "panel", "custom"]),
  weights: z.array(z.number()).optional(),
  blockSize: z.number().int().positive().optional(),
});

type MethodologySettings = {
  conjoint?: { questionTags: string[] };
  maxdiff?: {
    items: Array<{ id: string; label: string; tags?: string[] }>;
    tasks: Array<{ id: string; itemIds: string[] }>;
    anchors?: { positive?: string; negative?: string };
  };
  turf?: {
    candidateIds: string[];
    constraints?: Constraint[];
    maxComboSize: number;
  };
  segmentation?: { driverQuestionIds: string[]; scaling: "zscore" | "minmax" };
  driver?: {
    outcomeQuestionId: string;
    predictorIds: string[];
    method: "ridge" | "lasso";
  };
};

declare module "@formlink/schema" {
  interface Question {
    // analysis field can be used for question-specific methodologies
    analysis?: {
      maxdiff?: MethodologySettings["maxdiff"];
    };
    metadata?: Record<string, unknown>;
  }

  interface Settings {
    randomization?: z.infer<typeof RandomizationSchema>;
    methodology?: MethodologySettings;
    studyLinkage?: {
      correlationId: string;
      linkedForms: Array<{ formId: string; cellId: string }>;
    };
    weighting?: {
      targets: Array<{ key: string; distribution: Record<string, number> }>;
      maxWeight?: number;
    };
  }
}
```

## 5. Respondent Flow by Mode (Implementation Detail)

### 5.1 Shared Utilities

```ts
async function callBranchingEngine(params: BranchRequest) {
  const response = await fetch("/api/ai/branching", {
    method: "POST",
    body: JSON.stringify(params),
  });
  if (!response.ok) throw new Error("branching failed");
  const { nextQuestionId } = await response.json();
  return nextQuestionId;
}
```

### 5.2 Typeform Mode (`TypeFormView.tsx`)

1. `handleNextWithDirection` validates the current question.
2. If the question has `mightBranchOffNext` and branching is enabled, build the payload (`journeyScript`, `answerHistory`, submission metadata) and call `callBranchingEngine`.
3. Advance to the returned `nextQuestionId`; keep a navigation history for backtracking.
4. Apply randomization by seeding option order with `submissionId` when `settings.randomization` is defined.
5. `onSubmitForm` triggers submission and quality scoring.

```ts
if (
  currentQuestion?.mightBranchOffNext &&
  formSchema.settings?.branching?.enabled
) {
  const nextId = await callBranchingEngine({
    submissionId,
    currentQuestionId: currentQuestion.id,
    answerHistory: questionResponses,
    journeyScript: formSchema.settings?.journeyScript ?? "",
  });
  jumpToQuestion(nextId);
  return;
}
```

### 5.3 Chat Mode (`useChatStore.ts`)

- Assistant asks the branching engine whenever the current question carries `mightBranchOffNext`.
- The assistant narrates the transition (“Taking you to product preferences because you chose Brand B”), mirroring the response from the branching endpoint.
- When the conversation reaches completion state, submission and quality scoring are triggered.

```ts
const nextQuestionId = await callBranchingEngine({
  submissionId,
  currentQuestionId,
  answerHistory: currentInputs,
  journeyScript,
});
presentQuestion(nextQuestionId);
```

### 5.4 Classic Mode (`ClassicFormView.tsx` – Beta)

- Classic renders entire pages via React Hook Form; when a question with `mightBranchOffNext` is reached, we use the same `callBranchingEngine` helper to decide the next page.
- Classic remains beta while we stabilise the experience with shared helpers and quality prompts.

## 6. Advanced Analytics Modules

Each module lives under `apps/formcraft/app/api/responses/analytics/`. They accept the filtered response rows, method metadata, and options from the RI plan.

### 6.1 Conjoint (CBC/ACBC)

```ts
export async function computeConjoint(
  rows: Row[],
  spec: ConjointSpec,
  opts: ConjointOptions,
) {
  // Note: This is now more complex as the design matrix needs to be inferred from tagged questions.
  // This requires a robust implementation that can handle variations in how creators structure their questions.
  const designMatrix = buildDesignMatrixFromTaggedQuestions(
    rows,
    spec.questionTags,
  );
  const hbResults = await runHierarchicalBayes(designMatrix, opts.hyperParams);
  const utilities = extractUtilities(hbResults);
  const marketSim = simulateShare(utilities, opts.scenarios);
  return {
    type: "conjoint",
    utilities,
    attributeImportance: importance(utilities),
    marketSim,
    wtp: calculateWTP(utilities, spec.priceAttributeId),
  };
}
```

- Implementation uses a JS HB/MCMC library or custom Gibbs sampler (small sample).
- Cache heavy computation keyed by design hash + filtered respondents.

### 6.2 MaxDiff

```ts
export function computeMaxDiff(rows: Row[], spec: MaxDiffSpec) {
  const counts = tallyBestWorst(rows, spec.tasks);
  const scores = runMultinomialLogit(counts);
  const bootstrap = bootstrapConfidence(scores, rows);
  return { type: "maxdiff", scores, bootstrap };
}
```

### 6.3 TURF

```ts
export function computeTurf(rows: Row[], spec: TurfSpec) {
  const likedMap = buildLikedMap(rows, spec.candidateIds);
  const combos = greedySearch(likedMap, spec.maxComboSize, spec.constraints);
  return {
    type: "turf",
    combos,
    diminishingReturns: calcDiminishingReturns(combos),
  };
}
```

### 6.4 Segmentation

```ts
export function computeSegmentation(rows: Row[], spec: SegmentationSpec) {
  const matrix = prepareMatrix(rows, spec.driverQuestionIds, spec.scaling);
  const { bestModel, candidates } = runModelSweep(matrix, spec.maxK ?? 8);
  const personas = buildPersonas(bestModel.clusters, rows);
  return {
    type: "segmentation",
    clusters: bestModel.clusters,
    personas,
    modelSummary: candidates,
  };
}
```

### 6.5 Driver Analysis

```ts
export function computeDrivers(rows: Row[], spec: DriverSpec) {
  const outcome = extractOutcome(rows, spec.outcomeQuestionId);
  const predictors = extractPredictors(rows, spec.predictorIds);
  const model = runRidgeRegression(outcome, predictors);
  const importance = normaliseCoefficients(model.coefficients);
  const whatIf = simulateWhatIf(model, spec.whatIfScenarios);
  return {
    type: "driver",
    importance,
    coefficients: model.coefficients,
    whatIf,
  };
}
```

### 6.6 Pricing & Concept Tests (Adjacent)

- Pricing (Gabor-Granger, Van Westendorp, BPTO) modules reuse same analytics folder.
- Monadic/Monadic-sequential studies leverage `settings.studyLinkage` correlation ids for cell-level reporting.

## 7. Response Intelligence Integration

### 7.1 Plan Schema Extensions

```ts
const RIInsightSpecSchema = z.discriminatedUnion("type", [
  // existing types ...
  z.object({ type: z.literal("conjoint"), args: ConjointArgsSchema }),
  z.object({ type: z.literal("maxdiff"), args: MaxDiffArgsSchema }),
  z.object({ type: z.literal("turf"), args: TurfArgsSchema }),
  z.object({ type: z.literal("segmentation"), args: SegmentationArgsSchema }),
  z.object({ type: z.literal("driver"), args: DriverArgsSchema }),
  z.object({ type: z.literal("pricing"), args: PricingArgsSchema }),
]);
```

- `responseIntelligenceTool` system prompt updated with new type allow-lists.
- Repair agent understands argument shapes to auto-correct LLM outputs.
- Plan examples include referencing quality filters (`rpc.answer_filters.quality_score = { gte: 0.7 }`).

### 7.2 Frontend Rendering

- `ResponseCharts` dispatches to new card components (e.g., `ConjointCard`, `MaxDiffCard`, `TurfCard`, `SegmentationCard`, `DriverCard`).
- Cards support download, scenario toggles, persona previews.
- Insights grid uses `variant` hints to size cards appropriately (e.g., segmentation persona card uses `variant="large"`).

## 8. Sample End-to-End Flow (Pseudo Diagram)

```
Creator -> Study Wizard -> Metadata saved (methodology/randomization settings)
Respondent (any mode) -> AI branching + randomization -> Submission saved & quality scored
Analyst -> Ask RI -> Plan includes analytics + quality filters -> /api/responses
/api/responses -> Analytics modules compute -> Insight cards rendered -> Exports
```

## 9. Implementation Roadmap

1. **Foundation (Milestone A)**
   - Shared branching helper across modes, randomization seed utility, schema version bump.
2. **Quality Scoring (Milestone B)**
   - Integrated quality scoring on submission, AI prompt, RI plan filters.
3. **Methodology Metadata & Runtime (Milestone C)**
   - Authoring panels, schema extensions, runtime rendering for MaxDiff tasks.
4. **Analytics Modules (Milestone D)**
   - Conjoint (from tags), MaxDiff, TURF helpers + RI integration + visualization cards.
5. **Segmentation & Drivers**
   - Clustering/regression engines, persona/narrative generation, what-if tooling.
6. **Pricing & Monadic Add-ons**
   - Pricing modules, monadic cell orchestration, panel quota tie-ins.
7. **Operational Tooling**
   - Monitoring dashboards, retry admin UI, manual reprocessing, documentation/training.

## 10. Risks & Mitigations

- **Performance**: HB/MCMC can be heavy → cache results, allow async processing for very large studies.
- **Quality False Positives**: calibrate heuristics, expose score components, allow manual overrides.
- **Authoring Complexity**: hide advanced panels behind “Power Mode”, provide AI-generated defaults, strong validation.
- **Data Residency**: ensure background jobs run in-region; avoid exporting PII to external models without consent.
- **Model Drift**: version analytics/quality models, allow re-run with new versions, store metadata.

## 11. Open Questions

- Preferred HB/MNL implementation: in-house TypeScript vs. WASM wrappers for R/Python libs?
- How aggressively should we auto-generate sample plans/quotas vs. require confirmation?
- Do we need UI for manual weighting & significance testing before analytics launch?
- Should we expose per-respondent simulator (e.g., persona-level utilities) to external exports?
- How to surface design efficiency improvements iteratively (auto-redesign mid-field)?
