/**
 * Component Registry - Centralized component management for FormJunction
 *
 * Simple object-based registry that replaces the hardcoded componentMap
 * from UnifiedFormInput.tsx.
 *
 * Benefits:
 * - Single source of truth for component mappings
 * - Easy component registration without touching core files
 * - Type-safe component lookups
 * - Clear separation between registry data and rendering logic
 */

export {
  // Main registry object and functions
  componentRegistry,
  getComponent,
  transformComponentProps,
  hasRegisteredComponent,
  getRegisteredComponentTypes,
  addComponent,
  renderRegisteredComponent,

  // Types
  type ComponentRegistryEntry,
  type FormInputMode,
  type FormInputType,
} from "./ComponentRegistry";
