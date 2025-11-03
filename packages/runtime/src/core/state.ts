import { FormApi } from "@tanstack/form-core";
import { zodValidator } from "@tanstack/zod-form-adapter";
import type { Form, Question } from "../schema";
import { buildRuntimeSchema, createDefaultValues } from "./schema";
import { buildDynamicSchema } from "./validation/dynamicSchema";
import { createSnapshot, buildFieldErrors } from "./selectors";
import {
  getEligibleQuestionIds,
  getInitialQuestionId,
  getNextQuestionId,
  getPreviousQuestionId,
} from "./navigation";
import { createEventBus } from "./events";
import type {
  RuntimeActions,
  RuntimeApi,
  RuntimeConfig,
  RuntimeContext,
  RuntimeContextSnapshot,
  RuntimeEventMap,
  RuntimeStatus,
  RuntimeTransport,
  RuntimeUploadDescriptor,
  RuntimeValidationResult,
  RuntimeValues,
} from "../types";
import { createFormfillerTransport } from "../transport/formfillerTransport";
import type { FormlinkFlow } from "./formlinkFlow";

const noopTransport: RuntimeTransport = {
  async submit(values) {
    return {
      response: {
        stored: false,
        values,
      },
    };
  },
  async savePartial() {
    return;
  },
};

class RuntimeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RuntimeError";
  }
}

class TransportNotConfiguredError extends RuntimeError {
  constructor(method: keyof RuntimeTransport) {
    super(`Transport method "${method}" is not configured.`);
  }
}

function cloneValues(values: RuntimeValues): RuntimeValues {
  return { ...values };
}

function arraysEqual(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

class ContextStore {
  private current: RuntimeContextSnapshot;
  private listeners = new Set<(snapshot: RuntimeContextSnapshot) => void>();

  constructor(initial: RuntimeContextSnapshot) {
    this.current = initial;
  }

  setState(snapshot: RuntimeContextSnapshot) {
    this.current = snapshot;
    for (const listener of this.listeners) {
      listener(this.current);
    }
  }

  getSnapshot(): RuntimeContextSnapshot {
    return this.current;
  }

  subscribe(listener: (snapshot: RuntimeContextSnapshot) => void) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }
}

function normalizeValue(
  question: Question | undefined,
  value: unknown,
): unknown {
  if (!question) return value;

  switch (question.type.name) {
    case "text":
      if (question.type.format === "number") {
        if (value === "" || value === null || value === undefined) {
          return value === "" ? undefined : value;
        }
        if (typeof value === "number") return value;
        if (typeof value === "string") {
          const parsed = Number(value);
          return Number.isFinite(parsed) ? parsed : value;
        }
      }
      if (typeof value === "string" && value.trim() === "") {
        return undefined;
      }
      return value;
    case "singleChoice":
      if (Array.isArray(value)) {
        return value[0];
      }
      return value;
    case "multipleChoice":
    case "ranking":
      if (Array.isArray(value)) return value;
      if (value === null || value === undefined) return [];
      return [value].flat();
    case "rating":
    case "linearScale":
      if (value === "" || value === null || value === undefined)
        return undefined;
      if (typeof value === "number") return value;
      if (typeof value === "string") {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : value;
      }
      return value;
    default:
      return value;
  }
}

function toValidationResult(errors: string[]): RuntimeValidationResult {
  return {
    isValid: errors.length === 0,
    errors,
  };
}

export function createRuntime(config: RuntimeConfig): RuntimeApi {
  const { form } = config;
  const transport =
    config.transport ??
    (config.formfiller
      ? createFormfillerTransport(config.formfiller)
      : noopTransport);
  const uiMode = config.uiMode ?? "typeform";
  const flowEngine: FormlinkFlow | undefined = config.flowEngine;

  const schema = buildRuntimeSchema(form);
  const defaultValues = {
    ...createDefaultValues(form, config.initialValues),
  };

  const validatorAdapter = zodValidator();

  const formApi = new FormApi<RuntimeValues, ReturnType<typeof zodValidator>>({
    defaultValues,
    validatorAdapter,
    validators: {
      onChange: schema,
      onSubmit: schema,
    },
    onSubmit: async ({ value }) => {
      const result = await transport.submit(value);
      setStatus("completed");
      eventBus.emit("submit:success", { values: value, result });
      return result;
    },
    onSubmitInvalid: () => {
      setStatus("filling");
    },
  });

  const unmountForm = formApi.mount();

  function getSchema() {
    if (flowEngine) {
      try {
        return buildDynamicSchema(
          form,
          flowEngine,
          formApi.state.values,
          uiMode,
        );
      } catch {
        // fall through to base schema
      }
    }
    return schema;
  }

  const questionMap = new Map<string, Question>(
    form.questions.map(
      (question: Question) => [question.id, question] as const,
    ),
  );

  const eventBus = createEventBus();
  let isNavigating = false;
  const revealed = new Set<string>();

  const runtimeState: {
    status: RuntimeStatus;
    currentId: string | null;
    eligibleIds: string[];
  } = {
    status: config.initialStatus ?? "idle",
    currentId: config.initialCurrentId ?? null,
    eligibleIds: computeEligibleIds(),
  };

  if (runtimeState.currentId === null) {
    runtimeState.currentId = getInitialQuestionId(runtimeState.eligibleIds);
  }

  const initialSnapshot = buildSnapshot(runtimeState);
  const contextStore = new ContextStore(initialSnapshot);

  function buildSnapshot(state: {
    status: RuntimeStatus;
    currentId: string | null;
    eligibleIds: string[];
  }): RuntimeContextSnapshot {
    const formState = formApi.state;
    // Compute dynamic validity using flow-based schema if present
    const dynamicParsed = getSchema().safeParse(formState.values);
    return createSnapshot({
      status: state.status,
      currentId: state.currentId,
      eligibleIds: state.eligibleIds,
      values: cloneValues(formState.values),
      errors: buildFieldErrors(formState.fieldMeta),
      questionMap,
      isValid: dynamicParsed.success,
      isSubmitting: formState.isSubmitting,
    });
  }

  function syncContext() {
    contextStore.setState(buildSnapshot(runtimeState));
    const { progress } = contextStore.getSnapshot();
    eventBus.emit("progress:change", { progress });
  }

  function setStatus(nextStatus: RuntimeStatus) {
    if (runtimeState.status === nextStatus) return;
    runtimeState.status = nextStatus;
    eventBus.emit("status:change", { status: nextStatus });
    syncContext();
  }

  function setCurrentId(nextId: string | null) {
    if (runtimeState.currentId === nextId) return;
    runtimeState.currentId = nextId;
    eventBus.emit("cursor:change", { currentId: nextId });
    syncContext();
  }

  function setEligibleIds(nextEligible: string[]) {
    if (arraysEqual(runtimeState.eligibleIds, nextEligible)) return;
    runtimeState.eligibleIds = nextEligible;
    eventBus.emit("visibility:change", { eligibleIds: nextEligible });
    if (
      runtimeState.currentId !== null &&
      !runtimeState.eligibleIds.includes(runtimeState.currentId)
    ) {
      setCurrentId(getInitialQuestionId(runtimeState.eligibleIds));
    } else {
      syncContext();
    }
  }

  function computeEligibleIds(): string[] {
    try {
      if (flowEngine) {
        if (uiMode === "typeform") {
          return Array.from(
            flowEngine.visibleSet(formApi.state.values as any, "typeform"),
          );
        }
        return flowEngine.path(formApi.state.values as any);
      }
    } catch {
      // fall back
    }
    return getEligibleQuestionIds(form, formApi.state.values);
  }

  function recomputeEligibleIds() {
    const nextEligible = computeEligibleIds();
    setEligibleIds(nextEligible);
  }

  const unsubscribeFormStore = formApi.store.subscribe(() => {
    recomputeEligibleIds();
    syncContext();
  });

  const context: RuntimeContext = {
    get form() {
      return form;
    },
    get status() {
      return runtimeState.status;
    },
    get currentId() {
      return runtimeState.currentId;
    },
    get eligibleIds() {
      return [...runtimeState.eligibleIds];
    },
    get progress() {
      return contextStore.getSnapshot().progress;
    },
    get values() {
      return contextStore.getSnapshot().values;
    },
    get errors() {
      return contextStore.getSnapshot().errors;
    },
    get firstUnansweredId() {
      return contextStore.getSnapshot().firstUnansweredId;
    },
    get unansweredIds() {
      return contextStore.getSnapshot().unansweredIds;
    },
    get isValid() {
      return contextStore.getSnapshot().isValid;
    },
    get isSubmitting() {
      return contextStore.getSnapshot().isSubmitting;
    },
    subscribe(listener: (snapshot: RuntimeContextSnapshot) => void) {
      return contextStore.subscribe(listener);
    },
    getSnapshot() {
      return contextStore.getSnapshot();
    },
    get: {
      q: (questionId: string) => questionMap.get(questionId),
      value: <T = unknown>(questionId: string) =>
        formApi.getFieldValue(questionId) as T | undefined,
      error: (questionId: string) => {
        const errors = contextStore.getSnapshot().errors[questionId];
        return errors?.[0];
      },
      visibleError: (questionId: string) => {
        if (!revealed.has(questionId)) return undefined;
        const errors = contextStore.getSnapshot().errors[questionId];
        return errors?.[0];
      },
    },
  };

  const actions: RuntimeActions = {
    start() {
      if (runtimeState.status !== "idle") return;
      setStatus("filling");
      if (!runtimeState.currentId) {
        setCurrentId(getInitialQuestionId(runtimeState.eligibleIds));
      }
      syncContext();
    },
    set(questionId, value) {
      const question = questionMap.get(questionId);
      if (!question) {
        throw new RuntimeError(`Unknown question "${questionId}".`);
      }
      const normalized = normalizeValue(question, value);
      formApi.setFieldValue(
        questionId,
        normalized as unknown as RuntimeValues[string],
      );
      eventBus.emit("answer:set", { questionId, value: normalized });
      // Trigger on-change validation to clear errors as soon as the value becomes valid.
      // Then sync the snapshot after validation resolves (sync or async), ensuring errors are fresh.
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      Promise.resolve(formApi.validate("change"))
        .catch(() => undefined)
        .finally(() => {
          // If this field is now valid, clear any reveal flag
          const parsed = getSchema().safeParse(formApi.state.values);
          if (parsed.success) {
            revealed.delete(questionId);
          } else {
            const fieldIssues = parsed.error.issues.filter(
              (i: any) => (i.path?.[0] as string) === questionId,
            );
            if (fieldIssues.length === 0) {
              revealed.delete(questionId);
            }
          }
          // Maintain dynamic eligibility in case branching depends on this value
          recomputeEligibleIds();
          syncContext();
        });
    },
    blur(questionId) {
      if (uiMode !== "classic") return;
      const parsed = getSchema().safeParse(formApi.state.values);
      if (parsed.success) {
        revealed.delete(questionId);
      } else {
        const fieldIssues = parsed.error.issues.filter(
          (i: any) => (i.path?.[0] as string) === questionId,
        );
        if (fieldIssues.length > 0) {
          revealed.add(questionId);
        } else {
          revealed.delete(questionId);
        }
      }
      syncContext();
    },
    async next() {
      if (isNavigating) return;
      isNavigating = true;
      const currentId =
        runtimeState.currentId ??
        getInitialQuestionId(runtimeState.eligibleIds);
      if (!currentId) {
        isNavigating = false;
        return;
      }
      const parsed = getSchema().safeParse(formApi.state.values);
      if (uiMode === "typeform" && !parsed.success) {
        const messages = parsed.error.issues
          .filter((i: any) => (i.path?.[0] as string) === currentId)
          .map((i: any) => String(i.message ?? "Invalid"));
        if (messages.length > 0) {
          // Reveal-on-fail only for Typeform flows
          revealed.add(currentId);
          syncContext();
          isNavigating = false;
          return;
        }
      }
      let nextId = getNextQuestionId(currentId, runtimeState.eligibleIds);
      // In typeform mode, eligibleIds stops at the first unanswered.
      // That can block advancing on optional questions left blank.
      // Fall back to flow engine routing when available to advance along the branch.
      if (!nextId && uiMode === "typeform" && flowEngine) {
        try {
          const n = flowEngine.nextNode(formApi.state.values as any, currentId);
          if (n && n !== "END") nextId = n;
        } catch {
          // ignore engine errors and stay in place
        }
      }
      if (nextId) {
        setCurrentId(nextId);
        try {
          // eslint-disable-next-line @typescript-eslint/no-floating-promises
          formApi.validate("change");
        } catch {
          // noop
        }
        // If the new current step has no issues, make sure reveal flag is cleared
        const parsedNext = getSchema().safeParse(formApi.state.values);
        if (parsedNext.success) {
          revealed.delete(nextId);
        } else {
          const fieldIssues = parsedNext.error.issues.filter(
            (i: any) => (i.path?.[0] as string) === nextId,
          );
          if (fieldIssues.length === 0) {
            revealed.delete(nextId);
          }
        }
        syncContext();
      }
      isNavigating = false;
    },
    prev() {
      const currentId =
        runtimeState.currentId ??
        getInitialQuestionId(runtimeState.eligibleIds);
      if (!currentId) return;
      const prevId = getPreviousQuestionId(currentId, runtimeState.eligibleIds);
      if (prevId) {
        setCurrentId(prevId);
        try {
          // eslint-disable-next-line @typescript-eslint/no-floating-promises
          formApi.validate("change");
        } catch {
          // noop
        }
        const parsedPrev = getSchema().safeParse(formApi.state.values);
        if (parsedPrev.success) {
          revealed.delete(prevId);
        } else {
          const fieldIssues = parsedPrev.error.issues.filter(
            (i: any) => (i.path?.[0] as string) === prevId,
          );
          if (fieldIssues.length === 0) {
            revealed.delete(prevId);
          }
        }
        syncContext();
      }
    },
    goTo(questionId) {
      if (!runtimeState.eligibleIds.includes(questionId)) {
        throw new RuntimeError(
          `Question "${questionId}" is not eligible for display in the current state.`,
        );
      }
      setCurrentId(questionId);
      try {
        // eslint-disable-next-line @typescript-eslint/no-floating-promises
        formApi.validate("change");
      } catch {
        // noop
      }
      const parsedGoto = getSchema().safeParse(formApi.state.values);
      if (parsedGoto.success) {
        revealed.delete(questionId);
      } else {
        const fieldIssues = parsedGoto.error.issues.filter(
          (i: any) => (i.path?.[0] as string) === questionId,
        );
        if (fieldIssues.length === 0) {
          revealed.delete(questionId);
        }
      }
      syncContext();
    },
    async validate(questionId) {
      const parsed = getSchema().safeParse(formApi.state.values);
      if (parsed.success) {
        revealed.delete(questionId);
        syncContext();
        return toValidationResult([]);
      }
      const messages = parsed.error.issues
        .filter((i: any) => (i.path?.[0] as string) === questionId)
        .map((i: any) => String(i.message ?? "Invalid"));
      if (messages.length > 0) {
        revealed.add(questionId);
      } else {
        revealed.delete(questionId);
      }
      syncContext();
      return toValidationResult(messages);
    },
    async validateAll() {
      await formApi.validate("submit");
      syncContext();
      const aggregatedErrors = Object.values(
        contextStore.getSnapshot().errors,
      ).reduce<string[]>((acc, current) => {
        if (!current || current.length === 0) return acc;
        return acc.concat(current);
      }, []);
      return toValidationResult(aggregatedErrors);
    },
    async submit() {
      // Fail-fast: validate all before entering the submitting state.
      eventBus.emit("submit:requested", {
        values: cloneValues(formApi.state.values),
      });
      try {
        await formApi.validate("submit");
      } catch {
        // Ignore adapter throws; rely on state below.
      }
      const parsed = getSchema().safeParse(formApi.state.values);
      if (!parsed.success) {
        // Reveal invalid fields that are currently eligible (visible in this branch).
        const eligibleNow = new Set(runtimeState.eligibleIds);
        for (const issue of parsed.error.issues) {
          const qid = String(issue.path?.[0] ?? "");
          if (qid && eligibleNow.has(qid)) revealed.add(qid);
        }
        setStatus("filling");
        syncContext();
        return;
      }

      setStatus("submitting");
      syncContext();
      try {
        eventBus.emit("submit:transport:start", {
          values: cloneValues(formApi.state.values),
        });
        const result = (await formApi.handleSubmit()) as unknown;
        eventBus.emit("submit:transport:end", { result });
        // Fallback: if form-core onSubmit did not flip status, ensure completion here.
        if (runtimeState.status !== "completed") {
          setStatus("completed");
        }
      } catch (err) {
        setStatus("error");
        eventBus.emit("submit:error", { error: err });
        syncContext();
        throw err;
      }
    },
    reset() {
      formApi.reset();
      const eligible = getEligibleQuestionIds(form, formApi.state.values);
      runtimeState.eligibleIds = eligible;
      setCurrentId(getInitialQuestionId(eligible));
      setStatus("idle");
    },
    async savePartial() {
      if (!transport.savePartial) {
        throw new TransportNotConfiguredError("savePartial");
      }
      await transport.savePartial(formApi.state.values);
    },
    async upload(questionId, file) {
      if (!transport.upload) {
        throw new TransportNotConfiguredError("upload");
      }
      const descriptor = await transport.upload(questionId, file);
      eventBus.emit("upload:success", { questionId, descriptor });
      return descriptor;
    },
  };

  const events = eventBus.api;

  function dispose() {
    unsubscribeFormStore();
    unmountForm();
  }

  return {
    context,
    actions,
    events,
    dispose,
  };
}
