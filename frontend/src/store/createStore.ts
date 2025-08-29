// src/store/createStore.ts

/**
 * A listener has no arguments : when state changes, it just re-renders
 */
type Listener = () => void;

/**
 * Returns a minimalist state container with get, set and subscribe
 */
export function createStore<S>(initial: S) {
  let state = initial;
  const listeners = new Set<Listener>();

  return {
    get(): S {
      return state;
    },

    /**
     * Takes a pure function as a parameter to compute next state from current state
     */
    set(updater: (s: S) => S | void): void {
      const next = updater(state) ?? state;
      if (next !== state) {
        state = next as S;
        listeners.forEach((l) => l());
      }
    },

    /**
     * Adds a function to the set of listeners
     * Returns a function to unsubscribe from the set of listeners
     */
    subscribe(fn: Listener): () => void {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
  };
}
