# Formlink Runtime — Headless Ports Guide (v1)

This document describes how to build portable, framework‑agnostic UI on top of @formlink/runtime using headless controllers. It captures the full behavior expected by the React TypeformTemplate (all controls), how to wire the same logic in React, Vue, Solid, Svelte, Preact, and plain JS (Astro), and the edge‑cases and contracts you must respect to get identical UX.

Contents

- 1. Philosophy and Scope
- 2. Headless Architecture
- 3. UI Contracts by Control (all TypeformTemplate cases)
- 4. Keyboard and Focus Semantics (global + in‑control)
- 5. Navigation, Auto‑Advance and Direction
- 6. Ports: Wiring Examples (React/Vue/Solid/Svelte/Preact/Astro)
- 7. Data Attributes and Triggers
- 8. Validation and Required‑Only Gating
- 9. Devtools + Debugging
- 10. Tests and Guarantees
- 11. Component Boundaries & Responsibilities (Typeform Mode)
- 12. Rules, Behaviors, Expectations (Quick Reference)
- 13. Naming & Ergonomics (DX)
- 14. Unifying Families (Single‑Choice, Trigger‑Select)
- 15. Feature Packs (Country / Phone / Ranking)
- 16. Scaffold API Surfaces
- 17. Adopter Checklist

---

## 1. Philosophy and Scope

- Headless first: runtime, flow, validation, keyboard intent mapping, focus math and auto‑advance decisions must be framework‑agnostic, pure, and side‑effect‑free.
- Ports thinness: UI packages (react/vue/solid/…) should only bind events, set focus/tabIndex, and render transitions. All “what to do” decisions come from headless.
- Parity: every control in the React TypeformTemplate is supported:
  - Text (text/email/url/password/number/textarea)
  - Phone
  - Country select (combobox popover)
  - Single choice (InlineSelect)
  - Multiple choice (InlineMultiSelect)
  - Likert scale (InlineSelect wrapper)
  - Rating (stars)
  - Linear scale (1..N)
  - Ranking
  - Date
  - File upload
  - Address
  - Signature

## 2. Headless Architecture

Keep pure headless logic colocated in core under `src/core/typeform/*` (or similar), unexported from the package surface. React adapters (spreadable hooks) live under `src/headless/react/*` and are the only headless APIs exported.

Pure JS controllers (not exported):

- keyboard/KeyboardEngine
  - Input: { key, modifiers, targetRole?, defaultPrevented?, isOverlayOpen?, scopeEl? }, runtime (read‑only), feature flags (enterToContinue, lettersForChoices, numbersForScale)
  - Output: Intents[] (e.g., { type: 'Continue' }, { type: 'SetValue', id, value }, { type: 'ToggleValue', id, value }, { type: 'OpenPopover' })
  - Rules baked in for: singleChoice, multipleChoice, likertScale, linearScale, rating, date/country triggers bailout.

- focus/RovingFocusController
  - next(index, key, { itemCount, disabled? }): index
  - getInitialIndex({ selectedIndex, itemCount }): index

- choice/ChoiceController
  - selectByIndex(idx, { multi, options, current }): { nextValue, autoAdvance }
  - selectByLetter(letter, { options, current })
  - selectByDigit(digit, { options, current })

- scale/ScaleController
  - rating: selectByDigit(d, { min, max }) → { nextValue, autoAdvance }
  - linear: selectByDigit(d, { start, end, step }) → { nextValue, autoAdvance iff allowedValue }

- scaffold/TypeformScaffoldCore
  - derive(snapshot, engine) → { qId, index, total }
  - direction(prevIndex, nextIndex, navHint) → 1 | -1
  - shouldAutoAdvance(questionType, prevValue, nextValue) → boolean

- policy/ValidationPolicy
  - getSchema(values, engine) with required‑only gating for Typeform mode

- contracts/
  - Control contracts (see Section 3)
  - Data attributes: `data-fl-keyscope-stop` must bail global Enter/shortcuts when a trigger wants to handle the key locally.

## 3. UI Contracts by Control

For every control, the UI adapter must follow these contracts.

- Text (text/email/url/password/number)
  - Enter continues (unless IME/composing). Number input sanitizes (digits, single minus at start, one dot).
  - No auto‑focus on mount in Typeform mode; first Tab should land on input container, then focus input.

- Textarea
  - Underline style like text input. Enter continues; Shift+Enter inserts newline.

- Phone
  - Validity hints allowed; Enter continues. Prevent “invalid submit” if number incomplete.

- Country select (combobox popover)
  - Trigger: role="combobox", `data-fl-keyscope-stop`. Enter/Space toggles popover; preventDefault + stopPropagation.
  - Popover list: selection sets value; in Typeform mode, continue after a short delay.

- Single choice (InlineSelect)
  - Roving focus inside list; arrows/Home/End move focus; Enter/Space select.
  - Global letters A–Z and digits 1–9 select by index and auto‑advance.

- Multiple choice (InlineMultiSelect)
  - Roving focus; Enter/Space on focused option toggles; stopPropagation to avoid global Enter.
  - Global letters/digits toggle by index. Continue via group Enter or footer.

- Likert scale
  - Wrapper over InlineSelect with string options: same keyboard, letters/digits select + auto‑advance.

- Rating (stars)
  - Roving focus; arrows move focus; Enter/Space selects without advancing. Click selects and auto‑advances. Global digits 1..max select + auto‑advance.

- Linear scale
  - Roving focus; arrows move focus; Enter/Space selects without advancing.
  - Global digits: only select+advance if allowed by start..end..step. Focused option shows underline.

- Ranking
  - Implementation‑specific; common behaviors: Tab lands on first focusable control; Enter/Space interacts with embedded dropdown; bail global Enter with `data-fl-keyscope-stop` where necessary.

- Date
  - Trigger uses `data-fl-keyscope-stop`; Enter/Space toggles popover. If native input[type=date] is used, allow Enter to continue for optional questions only.

- File upload
  - On selection, validate (size, type, maxFiles). If upload handler is provided, upload then continue; else, continue immediately if desired by product.

- Address
  - Multi‑field; Enter steps through fields; Enter on last field continues.
  - Emit value only on user edits; avoid re‑emit loops when syncing from external state.

- Signature
  - Data URL (PNG) stored in value; Clear resets; optional upload handler to persist.

## 4. Keyboard and Focus Semantics

Global keyboard (headless KeyboardEngine):

- Enter to continue when not inside a control that owns Enter or marked with `data-fl-keyscope-stop`.
- Letters A–Z and digits 1–9 for singleChoice, multipleChoice, likertScale (index mapping). Single/likert auto‑advance; multi toggles.
- Numbers for scale/rating: 1..9 selects valid values (linear respects step), auto‑advance.
- Bails: overlays open, `event.defaultPrevented`, IME composing, editable targets (except input[type=date]), elements with `data-fl-keyscope-stop`.

In‑control keyboard:

- Roving focus (option lists, stars, scales): Arrow keys + Home/End move focus; Enter/Space act without advancing.
- Multi‑select option: Enter/Space toggles and must stopPropagation; group Enter continues.
- Combobox/Date triggers: Enter/Space toggle popovers; stopPropagation to bail global Enter.

Focus rules:

- No auto‑focus on question mount (Typeform feel). First Tab lands on container; container forwards focus to primary element (first/selected option, first star/scale, or rank select).
- Visible focus states: underline for linear scale; subtle focus highlight for stars.

## 5. Navigation, Auto‑Advance and Direction

- Auto‑advance (Typeform quick interactions):
  - singleChoice/likert: on click or letter/digit shortcut.
  - rating/linear: on click or numeric shortcuts (not on option‑focused Enter/Space).
  - country/dropdown: after selecting an item.
- Avoid double advance through stopPropagation and `data-fl-keyscope-stop`.
- Direction for transitions:
  - Use TypeformScaffoldCore.direction(prevIndex, nextIndex, navHint). Nav hint is +1/-1 when user clicks Continue/Back; otherwise fallback to index comparison.
- Progress bar should not animate with content; only question area transitions.

## 6. Ports: Wiring Examples

Below are wiring examples using the spreadable use\* hooks. You spread returned props on DOM nodes — no manual keyboard math or global intent plumbing in userland. The same hook shapes exist (or can be mirrored) across React/Vue/Solid/Svelte/Preact.

React — Single choice (InlineSelect/Likert)

```tsx
import { useSingleChoice, useLikert } from "@formlink/runtime/headless/react";

function SingleChoice({ id, options }) {
  const sc = useSingleChoice({ id, options, showKeyboardHints: true });
  return (
    <div {...sc.containerProps}>
      {options.map((_, i) => (
        <button key={i} {...sc.getItemProps(i)}>
          {options[i].label}
          {sc.renderHint(i)}
        </button>
      ))}
    </div>
  );
}

function Likert({ id, options }) {
  const lk = useLikert({ id, options, showKeyboardHints: true });
  return (
    <div {...lk.containerProps}>
      {options.map((_, i) => (
        <button key={i} {...lk.getItemProps(i)}>
          {options[i]}
          {lk.renderHint(i)}
        </button>
      ))}
    </div>
  );
}
```

React — Multiple choice

```tsx
import { useMultiChoice } from "@formlink/runtime/headless/react";

function MultiChoice({ id, options }) {
  const mc = useMultiChoice({ id, options, showKeyboardHints: true });
  return (
    <div {...mc.containerProps}>
      {options.map((_, i) => (
        <div key={i} {...mc.getItemProps(i)}>
          {options[i].label}
        </div>
      ))}
    </div>
  );
}
```

React — Rating and Linear scale (single‑choice family)

```tsx
import { useRating, useLinearScale } from "@formlink/runtime/headless/react";

function Rating({ id, max = 5 }) {
  const rt = useRating({ id, max, showKeyboardHints: true });
  return (
    <div {...rt.containerProps}>
      {Array.from({ length: max }, (_, i) => (
        <button key={i} {...rt.getStarProps(i)}>
          ★
        </button>
      ))}
    </div>
  );
}

function Linear({ id, start, end, step }) {
  const ls = useLinearScale({ id, start, end, step, showKeyboardHints: true });
  return (
    <div {...ls.containerProps}>
      {ls.values.map((_, i) => (
        <button key={i} {...ls.getItemProps(i)}>
          <span {...ls.getValueLabelProps(i)}>{ls.values[i]}</span>
        </button>
      ))}
    </div>
  );
}
```

React — Trigger‑select family (Country/Dropdown/Date)

```tsx
import { useTriggerSelect, useDate } from "@formlink/runtime/headless/react";

function Country({ id, options }) {
  const cb = useTriggerSelect({ id, options });
  return (
    <div>
      <button {...cb.triggerProps}>
        {cb.selectedLabel ?? "Select a country…"}
      </button>
      {cb.open && (
        <ul {...cb.listboxProps}>
          {cb.options.map((_, i) => (
            <li key={i}>
              <button {...cb.getItemProps(i)}>{cb.options[i].label}</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function DatePicker({ id }) {
  const dt = useDate({ id, mode: "popover" });
  return (
    <div>
      <button {...dt.triggerProps}>{dt.value ?? "Pick a date"}</button>
      {dt.open && /* render calendar using dt.getDayProps etc. */ null}
    </div>
  );
}
```

React — Text/Textarea/Phone

```tsx
import {
  useText,
  useTextarea,
  usePhone,
} from "@formlink/runtime/headless/react";

function Text({ id, type }) {
  const { inputProps } = useText({ id, type });
  return <input {...inputProps} />;
}
function Textarea({ id }) {
  const { textareaProps } = useTextarea({ id });
  return <textarea {...textareaProps} />;
}
function Phone({ id }) {
  const { inputProps } = usePhone({ id });
  return <input {...inputProps} />;
}
```

React — Ranking, File Upload, Address, Signature

```tsx
import {
  useRanking,
  useFileUpload,
  useAddress,
  useSignature,
} from "@formlink/runtime/headless/react";

function Ranking({ id, options }) {
  const rk = useRanking({ id, options });
  return (
    <ul>
      {options.map((o, i) => (
        <li key={o.value} {...rk.getItemProps(i)}>
          {o.label}
          <button onClick={() => rk.moveUp(i)}>↑</button>
          <button onClick={() => rk.moveDown(i)}>↓</button>
        </li>
      ))}
    </ul>
  );
}

function FileUpload({ id, accept }) {
  const fu = useFileUpload({ id, accept });
  return (
    <div className="border-dashed p-4">
      <button {...fu.browseProps}>Browse</button>
      <input {...fu.inputProps} />
    </div>
  );
}

function Address({ id }) {
  const ad = useAddress({ id });
  return (
    <div className="grid grid-cols-2 gap-4">
      {ad.fields.map((f, i) => (
        <input
          key={f}
          {...ad.getFieldProps(f, i, i === ad.fields.length - 1)}
        />
      ))}
    </div>
  );
}

function Signature({ id }) {
  const sig = useSignature({ id });
  return (
    <div>
      <canvas ref={sig.canvasRef} {...sig.canvasProps} />
      <button onClick={sig.clear}>Clear</button>
    </div>
  );
}
```

React — Scaffold (branching, progress, direction, continue)

```tsx
import { useTypeformScaffold } from "@formlink/runtime/headless/react";

function TypeformPage() {
  const {
    qId,
    q,
    index,
    total,
    percent,
    direction,
    setNavHint,
    onContinue,
    onBack,
    enterHint,
  } = useTypeformScaffold();
  if (!qId || !q) return null;
  return (
    <div>
      <Progress value={percent} label={`${index + 1} / ${total}`} />
      <Transition key={qId} direction={direction}>
        {/* render Header + one control using the hooks above */}
      </Transition>
      <Footer
        onBack={() => {
          setNavHint(-1);
          onBack();
        }}
        onContinue={() => {
          setNavHint(1);
          onContinue();
        }}
        enterHint={enterHint}
      />
    </div>
  );
}
```

Vue/Solid/Svelte/Preact/Astro

- Provide equivalent composables/hooks with the same names and return shapes (containerProps/getItemProps/etc.).
- Spread (or bind) the prop getters on DOM nodes; map event handlers to the framework’s event system.
- The same shortcut gating and data attributes apply (`data-fl-hints`, `data-fl-keyscope-stop`).

## 7. Data Attributes and Triggers

- `data-fl-keyscope-stop`: Mark any element that consumes Enter/Space locally (combobox triggers, date triggers, popover openers). The global keyboard engine will bail if the event target or its ancestors have this attribute.
- Triggers must handle Enter/Space with preventDefault and stopPropagation, and toggle the popover open/close state.

## 8. Validation and Required‑Only Gating

- In Typeform mode, visibility and navigation are gated only by the first required unanswered question. Optional unanswered fields must not block Back/Next.
- Build schemas dynamically per eligible set so skipped fields are optional.
- Ensure submit reveals errors only for eligible questions to avoid noise.

## 9. Devtools + Debugging

- Show decisions per step: engine.explain(values, currentId) (matched route, priorities, ANY routes).
- Show eligibleIds and first required unanswered.
- Log direction anomalies (rare branch reorders); direction = TypeformScaffoldCore.direction.

## 10. Tests and Guarantees

Headless unit tests (no DOM):

- KeyboardEngine: letters/digits mapping, multi toggle, scale/rating digits, overlay bail, data‑attr bail, IME composing bail.
- ChoiceController: selectByIndex/Letter/Digit (multi/single/likert), auto‑advance signals.
- ScaleController: allowed values for linear (start/end/step), rating min/max.
- RovingFocus: next/home/end with disabled items.
- ScaffoldCore: derive(), direction() freeze, auto‑advance policy.

Adapter smoke tests (framework):

- Ensure Enter won’t advance from focused multi/rating/scale options (stopPropagation works).
- Triggers: Enter toggles popover; global Enter doesn’t fire.

By following these contracts and wiring patterns, you can keep the runtime logic headless and reuse it across React, Vue, Solid, Svelte, Preact, and plain JS, while preserving the Typeform‑accurate UX established in the React implementation.

---

## 11. Component Boundaries & Responsibilities (Typeform Mode)

This section makes boundaries explicit so authors know what to expect and where logic lives.

- Headless Core (pure)
  - Flow decisions (FormlinkFlow integration): derive path, visible set (typeform gating), next/prev fallback, progress.
  - Keyboard → intents: Enter‑to‑continue, letters/digits gating, numbers for scale/rating, overlay/data‑attr bailouts.
  - Roving focus math: Arrow/Home/End movement and initial index.
  - Auto‑advance policy: click/shortcut quick‑advance decisions; never from option‑focused Enter/Space where inappropriate.
  - Direction: prev/next index + navHint → +1/−1.

- Framework Adapters (thin)
  - Prop getters: containerProps, getItemProps, triggerProps, inputProps, textareaProps, getFieldProps.
  - Role/ARIA and tabIndex: apply from headless decisions; set focus; stopPropagation where required.
  - Timers: implement small delays for quick‑advance (e.g., 150ms) when signaled.
  - Styling affordances (optional): e.g., underline focus label for linear.

- Scaffold (page‑level)
  - Exposes: qId/q/index/total/percent/direction/setNavHint/onContinue/onBack/enterHint.
  - Renders Progress (non‑animated), Transition (keyed by qId) around Header+Body+Footer.
  - Never encodes control behavior; composes control hooks only.

## 12. Rules, Behaviors, Expectations (Quick Reference)

- Keyboard (global)
  - Enter continues unless: focused element owns Enter (multi/rating/linear), or target tree has `data-fl-keyscope-stop` (combobox/date triggers), or overlay open.
  - Letters/digits shortcuts are OFF by default and only ON when a control sets `data-fl-hints` (i.e., visible hint rendered).
  - Numbers for scale/rating: 1..9 select valid values (linear respects step), auto‑advance when hints are ON.

- Keyboard (in‑control)
  - Arrow keys + Home/End move focus between items (roving focus).
  - Enter/Space on option: select/toggle; never continue for multi/rating/linear.
  - Triggers: Enter/Space toggle (preventDefault + stopPropagation).

- Focus
  - No auto‑focus on question mount (Typeform feel). First Tab lands on container; it forwards focus to primary item.
  - Visuals: linear shows underline on focus; rating shows highlight on focused star.

- Auto‑advance
  - Quick‑advance on click/shortcut for: single/likert, rating, linear, combobox selection.
  - Never quick‑advance from option‑focused Enter/Space in multi/rating/linear.

- Branching + Progress
  - Eligible set = engine.visibleSet(values, 'typeform') → stop at first REQUIRED unanswered (optionals don’t block).
  - Numbering/progress = engine.path(values) (branch‑aware). Progress bar does not animate; only content does.

- Direction
  - Back/Continue call setNavHint(−1/+1) just before action; fallback to index comparison.

## 13. Naming & Ergonomics (DX)

- Hooks are named by question semantics, not widgets:
  - useSingleChoice, useMultiChoice, useLikert, useRating, useLinearScale, useTriggerSelect, useDate, useText, useTextarea, usePhone, useRanking, useFileUpload, useAddress, useSignature.
- Prop getters are verbs that describe their target:
  - containerProps, getItemProps(i), getStarProps(i), getValueLabelProps(i), triggerProps, listboxProps, inputProps, textareaProps, getFieldProps(name).
- Spreadable by default: authors “spread and style” — no keyboard math in userland.
- Shortcut gating is intuitive: showKeyboardHints = true renders hint UI and sets `data-fl-hints`; global shortcuts only fire then.
- Enter hint guidance: scaffold.enterHint false whenever control option owns Enter or a trigger stops it; true otherwise.

## 14. Unifying Families (Single‑Choice, Trigger‑Select)

- Single‑choice family: vertical InlineSelect, horizontal linear/rating, likert (strings) share useSingleChoice semantics; rating/linear add numeric maps and alignment.
- Trigger‑select family: country, dropdown, date use useTriggerSelect semantics; triggers always mark `data-fl-keyscope-stop`; selection auto‑advances.

## 15. Feature Packs (Country / Phone / Ranking)

Some components are domain‑heavy. Keep headless core pure; expose adapter interfaces:

- CountryProvider: countries [{ code, name, flag }], resolveName(code)
- PhoneValidator: format, isValid, getDialCode, inferCountry
- RankingDndAdapter: onDragStart/onDragOver/onDrop → reorder(next)

React/Vue/Solid adapters accept these providers and wire them into the UI. Headless hooks accept a provider prop and remain agnostic to the UI library.

## 16. Scaffold API Surfaces

- useTypeformScaffold():
  - qId, q, index, total, percent
  - direction, setNavHint(+1/−1)
  - onContinue (validate → next/submit), onBack
  - enterHint
- useTypeformProgress(): index, total, percent
- useTypeformDirection(): { navHint, setNavHint }

## 17. Adopter Checklist

- Spread prop getters; don’t hand‑roll keyboard logic.
- Render hints to enable shortcuts; otherwise shortcuts remain off.
- Mark triggers with `data-fl-keyscope-stop`; toggle popovers on Enter/Space and stopPropagation.
- For multi/rating/linear: stopPropagation on option Enter/Space; set value only (no continue).
- Use scaffold for branching, progress, and direction; Progress is outside Transition; content is wrapped by Transition keyed by qId.
- Avoid value re‑emit loops in multi‑field controls (e.g., Address): emit on user edits only.
