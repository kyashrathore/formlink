export { createRuntime } from "./core/state";
export {
  fetchTransport,
  RuntimeTransportError,
  type FetchTransportOptions,
} from "./transport/fetchTransport";
export {
  createFormfillerTransport,
  type FormfillerTransportOptions,
} from "./transport/formfillerTransport";
export {
  createMockTransport,
  type MockTransportOptions,
} from "./transport/mockTransport";

export type {
  RuntimeApi,
  RuntimeActions,
  RuntimeConfig,
  RuntimeContext,
  RuntimeContextSnapshot,
  RuntimeEventMap,
  RuntimeEvents,
  RuntimeProgress,
  RuntimeStatus,
  RuntimeSubmissionResult,
  RuntimeTransport,
  RuntimeUploadDescriptor,
  RuntimeValidationResult,
  RuntimeValues,
} from "./types";

// Devtools provided as a separate subpath: `@formlink/runtime/devtools`

// FormlinkFlow (routing/flow engine) experimental surface
export type {
  Route as FormlinkFlowRoute,
  RouteSpec as FormlinkFlowRouteSpec,
  Program as FormlinkFlowProgram,
  DecisionTrace as FormlinkFlowDecisionTrace,
  Analysis as FormlinkFlowAnalysis,
} from "./core/formlinkFlow";
export {
  compile as compileFormlinkFlow,
  analyze as analyzeFormlinkFlow,
  nextNode as nextNodeFormlinkFlow,
  path as pathFormlinkFlow,
  visibleSet as visibleSetFormlinkFlow,
  explain as explainFormlinkFlow,
} from "./core/formlinkFlow";
export { FormlinkFlow } from "./core/formlinkFlow";
