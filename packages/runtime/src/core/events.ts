import type { RuntimeEventMap, RuntimeEvents } from "../types";

type EventName = keyof RuntimeEventMap;
type EventHandler<K extends EventName> = (payload: RuntimeEventMap[K]) => void;

export interface EventBus {
  emit<K extends EventName>(event: K, payload: RuntimeEventMap[K]): void;
  api: RuntimeEvents;
}

export function createEventBus(): EventBus {
  const listeners = new Map<EventName, Set<EventHandler<EventName>>>();

  const on = <K extends EventName>(
    event: K,
    handler: EventHandler<K>,
  ): (() => void) => {
    let scoped = listeners.get(event) as Set<EventHandler<K>> | undefined;
    if (!scoped) {
      scoped = new Set<EventHandler<K>>();
      listeners.set(event, scoped as Set<EventHandler<EventName>>);
    }
    scoped.add(handler);
    return () => {
      scoped.delete(handler);
    };
  };

  const off = <K extends EventName>(event: K, handler: EventHandler<K>) => {
    const scoped = listeners.get(event);
    if (!scoped) return;
    scoped.delete(handler as EventHandler<EventName>);
  };

  const once = <K extends EventName>(
    event: K,
    handler: EventHandler<K>,
  ): (() => void) => {
    const wrapped: EventHandler<K> = (payload) => {
      off(event, wrapped);
      handler(payload);
    };
    return on(event, wrapped);
  };

  const emit = <K extends EventName>(
    event: K,
    payload: RuntimeEventMap[K],
  ): void => {
    const scoped = listeners.get(event);
    if (!scoped || scoped.size === 0) return;
    [...scoped].forEach((handler) => {
      try {
        handler(payload);
      } catch (err) {
        // Fail loudly but keep other listeners running.
        setTimeout(() => {
          throw err;
        }, 0);
      }
    });
  };

  const api: RuntimeEvents = {
    on,
    once,
    off,
  };

  return { emit, api };
}
