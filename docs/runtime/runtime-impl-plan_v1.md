# @formlink/runtime — Implementation Plan (v1)

Last updated: 2025-10-18
Status: Detailed Implementation Plan

## 1. Objectives

- Create a headless runtime for form logic, built on TanStack Form.
- Ensure the core is edge-safe (ESM-only, no Node dependencies).
- Expose a simple, three-part API: `context` (read), `actions` (write), and `events` (subscribe).
- Centralize validation, navigation, and state management to keep UI components simple.

## 2. Core Implementation Details

### `createRuntime(config)`

This is the main entry point of the package. It will internally call a React hook that wraps `useForm` from TanStack Form.

1.  **Dynamic Zod Schema Generation**: Inside this function, the runtime will iterate through `config.form.questions`.
2.  For each question, it will construct a `zod` validator chain by mapping the `question.validations` and `question.type` properties to Zod methods (e.g., `z.string().min(5).email()`).
3.  These individual validators will be assembled into a single `z.object({...})` representing the entire form's data structure.
4.  **TanStack Form Initialization**: It will call `useForm` and pass the dynamically generated Zod schema to the `zodValidator()` adapter.
5.  **API Exposure**: It will create and return the `context`, `actions`, and `events` objects. These will be memoized wrappers around the state and methods provided by the `useForm` hook.

### The `context` Object (Read-Only State)

This object provides a reactive, read-only view of the form's current state.

- `context.status`: A state machine string: `'idle' | 'filling' | 'submitting' | 'completed' | 'error'`. This is managed by the `actions`.
- `context.currentId`: The ID of the currently focused question. Its value is derived from navigation actions.
- `context.eligibleIds`: Ordered list of question IDs that currently pass conditional logic. This does **not** exist in the current app; today each mode asks the store “should this question show?” ad hoc. The runtime evaluates the journey script + per-question rules once per state change and caches the ordered result so every renderer works from the same source of truth. Mode-specific use:
  - **Typeform**: still renders one card at a time, but looks up the active question via `context.eligibleIds[currentIndex]`. When branching skips questions, the runtime mutates `eligibleIds` so navigation and progress stay in sync.
  - **AI Chat**: the UI does not list questions, but tool handlers need a definitive “next question” index. `eligibleIds` lets the runtime answer that without recomputing logic on every tool invocation.
  - **Classic**: multiple questions can appear on the same page. `eligibleIds` is the canonical ordered set; Classic filters that list by page/column metadata before rendering. Removing an ID here immediately hides it in Classic.
- `context.progress`: A derived object `{ index, total, percent }` calculated from `currentId` and `eligibleIds`.
- `context.get.value(qId)`: A getter that wraps `form.useStore(s => s.values[qId])` for optimized, field-level subscriptions.

### The `actions` Object (State-Changing Methods)

- `actions.start()`: Sets `context.status` to `'filling'` and sets `currentId` to the first question.
- `actions.set(qId, value)`: A wrapper around TanStack Form's `form.setFieldValue(qId, value)`.
- `actions.next()`: First, calls `form.validateField(context.currentId)`. If valid, it calculates the next question's index from the `eligibleIds` array and updates `context.currentId`.
- `actions.prev()`: Moves backwards in the `eligibleIds` array to update `context.currentId`.
- `actions.submit()`:
  1.  Sets `context.status` to `'submitting'`.
  2.  Calls `form.validateAll()`.
  3.  If valid, calls `transport.submit(form.state.values)`.
  4.  On success, sets `status` to `'completed'`. On failure, sets to `'error'`.
- `actions.reset()`: Calls `form.reset()` and sets `context.status` to `'idle'`.

### The `transport` Object

- The `fetchTransport({ baseUrl })` factory will return an object with `submit`, `savePartial`, etc. methods.
- Each method will be an `async` function that uses the global `fetch` API to make `POST`/`PUT` requests, handling JSON serialization and response parsing.

## 3. Audit of Current Form Runtime Consumers (2025-10-18)

### 3.1 FormPageClient (apps/formfiller/app/[formId]/FormPageClient.tsx)

- Wraps the entire page in `FormModeProvider` and picks the initial mode from `searchParams.mode`, `searchParams.aimode`, or `formSchema.settings.defaultMode` (fallback `"ai"`). URL params override schema defaults.
- Calls `useThemeLoader(formSchema)` once per mount; the hook applies CSS variables from `formSchema.settings.theme_overrides.shadcn_css` and toggles the `dark`/`light` classes. Theme reapplication on schema changes is currently blocked by an internal `hasLoadedRef`.
- Delegates all business state to `useAppFormStore()`. The store is mode-agnostic; UI variants (AI, Typeform, Classic) receive the same callbacks/derived getters.
- `handleAnswerChange` fans out by `questionType` string and relies on store helpers (`handleSingleChoiceChange`, `setQuestionResponse`, `handleTextChange`, etc.). Any new question type must be whitelisted here or it will fall through to the text handler.
- Loading guard: while `useThemeLoader` reports `isLoading`, the component returns a full-screen spinner which blocks the rest of the tree (including AI chat bootstrap).

### 3.2 Shared Store Layer (apps/formfiller/lib/stores/useAppFormStore.ts)

- Zustand store persisted under `formlink:typeform:<formId>`; `initialize` merges `initialData`, localStorage, and generates a UUID `submissionId` (persisted). A background `apiServices.saveAnswers` call seeds the submission record (status `in_progress`).
- `setQuestionResponse` updates in-memory state, mirrors the change to localStorage, and fire-and-forgets `apiServices.savePartialAnswer`. Errors are intentionally swallowed, so eventual consistency with the backend depends on retrying user interactions.
- `shouldShowQuestion` is a stub that always returns `true`; conditional logic (`question.conditionalLogic`) is not enforced anywhere else. Resume flows therefore render questions that should be hidden. `TODO(runtime): implement conditional question filtering parity with useAppFormStore.shouldShowQuestion`.
- `submitForm` converts the `questionResponses` map back into the legacy `{questionId,value}` array before calling `apiServices.saveAnswers`. On success it clears localStorage to avoid showing stale answers after completion.
- File uploads go through `apiServices.uploadFile` with `{formId, submissionId, questionId}`; responses are stored as `{url,name,size}` objects to satisfy both Classic and Typeform UI components.

### 3.3 AI Mode (apps/formfiller/app/[formId]/FormAIComponent.tsx and chat subtree)

- Relies on `useChatStore` (Zustand + localStorage) plus `useChat` from `@ai-sdk-tools/store`. `useFormSession` seeds the store with form metadata, resolves a submission ID ( Supabase check via `validateSubmissionExists` ), pulls `/api/forms/:id/chat-history`, and hydrates chat messages + current question.
- `submitSelection` is the central write path for structured answers: update local store (`setCurrentInput`), package the entire response envelope (`responses`, `justSavedAnswer`, `submissionId`, `isTestSubmission`), then call `sendMessage` with a synthesized user message. A 250 ms delay preserves UX parity with Typeform auto-advance.
- `applyToolResult` currently supports `tool-saveAnswer` (sets local answer + advances `currentQuestionId`) and `tool-completeSubmission` (marks the conversation as `"completed"`). Any additional AI tool must be wired here; otherwise responses silently drop.
- On errors the component surfaces human-readable strings (“Rate limit”, “Network”, fallback) and enables a “Retry” button that replays the last user utterance from `lastUserTextRef`.
- File uploads call `apiServices.uploadFile` and then `submitSelection` with a synthetic “Uploaded file: …” display text. Missing `formId/submissionId` short-circuits the upload with an error toast.
- Pseudo-code reference:

```ts
async function handleToolResult(part: ToolPart) {
  const tool = part.type.replace("tool-", "");
  switch (tool) {
    case "saveAnswer":
      if (part.output?.questionId && part.output?.value !== undefined) {
        chatStore.setCurrentInput(part.output.questionId, part.output.value);
      }
      if (part.output?.nextQuestionId) {
        chatStore.setCurrentQuestionId(part.output.nextQuestionId);
      }
      break;
    case "completeSubmission":
      chatStore.setFormDisplayState("completed");
      break;
    default:
    // ignore unknown tool
  }
}
```

### 3.4 Typeform Mode (apps/formfiller/components/typeform)

- `TypeFormView` holds local UI state (`activeQuestionIndex`, `navigationHistory`, `showConfetti`, `uploadedFile`) while the business state lives in `useAppFormStore`. It calls `onInitialize(schema, formId)` on mount and relies on store getters (`getCurrentQuestion`, `getProgress`, etc.).
- Navigation flow: `handleNextWithDirection` → validate current question (`validateTextValue` for text, non-empty checks otherwise) → optional AI branching fetch (`/api/ai/branching`) → fallback to `onNavigateNext` (store). When the store returns `null`, the UI triggers `onSubmitForm`, shows confetti, and renders `CompletionScreen`.
- Auto-advance is triggered via an effect watching `lastAnsweredQ`. Question types eligible for instant advance: `singleChoice`, `rating`, `linearScale`, `likertScale`, `fileUpload`. The effect compares timestamps (`activatedAtRef` vs `lastInteractionAtRef`) to avoid replaying historical answers.
- Keyboard/scroll/swipe integrations (`useTypeFormKeyboard`, `useTypeFormScroll`, `useTypeFormSwipe`) hook window-level events and call `onNext`/`onPrevious`. Any blocking overlay should toggle the internal `isOverlayOpen` flags to avoid accidental navigation.
- File uploads run through `onFileUpload(questionId, file)` (store) and then call `handleAnswerChange(questionId, url, "fileUpload")` on success. Failures raise an `alert()` placeholder.
- `TypeFormQuestionInputSwitcher` maps schema-driven question metadata to UI components (`UnifiedMultiSelect`, `TypeFormLinearScale`, `TypeFormAddress`, etc.). JSON-encoded answers (ranking, multiple choice) are normalized both directions.
- Pseudo-code reference for next navigation:

```ts
async function goNext() {
  const question = store.getCurrentQuestion(idx);
  const response = store.questionResponses[question.id];
  if (!isValid(question, response)) return;

  if (isBranchable(question)) {
    const branch = await fetchNextQuestion(question);
    if (branch?.nextQuestionId) {
      setActiveQuestionIndex(indexOf(branch.nextQuestionId));
      recordHistory(branch.nextQuestionId);
      return;
    }
  }

  const nextIndex = store.getNextValidQuestionIndex(idx);
  if (nextIndex !== null) {
    setActiveQuestionIndex(nextIndex);
    recordHistory(nextIndex);
  } else {
    const ok = await store.submitForm();
    if (ok) markComplete();
  }
}
```

### 3.5 Classic Mode (apps/formfiller/components/classic)

- Uses `react-hook-form` + per-question Zod schemas (built in `formSchema_zod`). All required/format validations are enforced client-side before advancing pages.
- Page layout is driven by `question.styling?.colSpan` (default `12`). `getQuestionsForPage` ignores conditional logic; it purely groups by `question.page` and `question.styling.page`.
- `onSubmit` iterates every form value, invokes `onAnswerChange` with the schema-derived question type, and then calls `onSubmitForm`. Success toggles `showConfetti` and renders `CompletionScreen` with `calcScore` + optional AI-generated markdown (`useResultPage`).
- `QuestionInputSwitcher` mirrors the Typeform switcher but renders shadcn primitives (`Select`, `Checkbox`, etc.). Ranking uses `dnd-kit`; File upload reuses the shared upload API; Address fields mirror the Typeform layout.
- `onRestart` clears the store via `onRestart` (Zustand) and resets RHF state.
- Pseudo-code reference for submit:

```ts
async function handleClassicSubmit(formValues) {
  for (const [questionId, value] of Object.entries(formValues)) {
    if (value === undefined || value === null || value === "") continue;
    const question = safeQuestions.find((q) => q.id === questionId);
    if (!question) continue;
    store.onAnswerChange(questionId, value, question.type.name);
  }
  const submitted = await store.onSubmitForm();
  if (submitted) setShowConfetti(true);
}
```

### 3.6 Theme & Mode Utilities

- `FormModeProvider` listens to Next.js `useSearchParams()` unless an explicit `urlSearchParams` prop is provided (as in FormPageClient and Typeform/Ai intro overrides). Changing the query param updates the mode via effect.
- `useThemeLoader` defaults to `dark` theme when `theme_mode` is absent. When `theme_mode === "system"`, it mirrors `prefers-color-scheme`. A `hasLoadedRef` prevents re-running even if `formSchema` changes; a manual reset is required to reapply themes on schema updates.
- `useRedirect` enforces a delayed client-side redirect when `isCompleted` flips true and a URL exists. Both AI and Typeform paths rely on this hook; canceling redirection requires clearing or debouncing the condition before the timeout fires.

### 3.7 Services & Networking

- `apiServices.uploadFile` POSTs `FormData` to `/api/upload`. Error bodies are parsed when possible; otherwise status text is surfaced.
- `apiServices.saveAnswers` translates the legacy answers array into `{ allResponses }` before POSTing. Partial saves reuse the same endpoint with `isPartial: true`.
- `useFormSession` assembles the initial runtime context: merges persisted submission ID, calls `initializeForm(...)` on the chat store (which itself may hit Supabase to validate IDs), fetches `/api/forms/:formId/chat-history`, hydrates messages + responses, and marks the display state as `"completed"` when the backend reports `submissionStatus === "completed"`.
- `useChatStore.handleFileUpload` duplicates the async upload logic used by AI tool callbacks; it stores an `ephemeralUploadedFile` while the request is inflight to aid UI placeholders.

### 3.8 Edge Cases & Gaps Identified

- `FormPageContent.handleStartQuiz` is a no-op; Typeform/Classic views call it but it never toggles store state. Confirm whether this should trigger `startFormInteraction()` or similar.
- Conditional visibility is absent across all modes (`shouldShowQuestion` always true). Resume flows may resurface hidden questions and break branching scripts.
- Typeform address flow calls `window.triggerAddressSubmit()` if available before continuing. No component sets this global, so the call currently does nothing; confirm whether this is legacy or needs a runtime callback.
- AI path relies on `useChatStore.setupFormCore` invoking `createServerClient(null, "service")` inside a client bundle. Ensure the Supabase helper is browser-safe or gate it behind an environment check.
- `useThemeLoader` never re-runs after first mount, so switching to a new form with different theme assets within the same session will keep stale CSS variables.
- TODO(runtime): consolidate file-upload result shapes so Classic, Typeform, and AI paths share a common `{ url, name, size, mimeType? }` interface.

## 4. Package & Module Structure

The package layout will be organized to separate concerns clearly.

- `packages/runtime/src/core/state.ts`: Contains the main `createRuntime` function and the Zod schema generation logic.
- `packages/runtime/src/core/selectors.ts`: Contains pure functions for deriving state like `progress`.
- `packages/runtime/src/core/navigation.ts`: Implements the logic for `next`, `prev`, and `goTo` actions.
- `packages/runtime/src/core/persistence.ts`: Implements the `submit` action and debounced `savePartial` logic.
- `packages/runtime/src/transport/fetchTransport.ts`: The default edge-safe transport implementation.
- `packages/runtime/src/react/`: Subpath for React-specific hooks and adapters.
- `packages/runtime/src/chat/`: Subpath for the isolated chat components and hooks.

## 5. Testing & Acceptance Plan

1.  **Unit Tests**: Each core module (navigation, persistence, selectors, Zod generation) will be unit-tested in isolation with mocked data.
2.  **Integration Tests (Storybook)**: The primary testing ground before migrating the main app will be the `apps/ui-docs` Storybook.
    - The example forms from `docs/runtime/examples/` will be added as individual stories.
    - This will test the live integration of the `@formlink/runtime` package with the `@formlink/ui` components.
    - Tests will cover the full lifecycle: `idle` (start screen) -> `filling` (question navigation) -> `submitting` (loading state) -> `completed` (thank you screen).
3.  **CI Checks**: `pnpm -w typecheck` and `pnpm -w lint` must pass.
