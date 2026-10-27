/**
 * Historial para deshacer/rehacer. Los cambios seguidos (menos de `coalesceMs` entre uno y otro,
 * como un arrastre o escribir una palabra) se agrupan en un solo paso.
 */
export function createUndoHistory<T>(options: { limit?: number; coalesceMs?: number; now?: () => number } = {}) {
  const limit = options.limit ?? 100;
  const coalesceMs = options.coalesceMs ?? 400;
  const now = options.now ?? (() => Date.now());

  let past: T[] = [];
  let future: T[] = [];
  let lastChangeAt = -Infinity;

  return {
    /**
     * Llamar ANTES de aplicar un cambio, con el estado que se va a reemplazar.
     * `mergeable: false` para acciones puntuales (agregar, borrar): siempre son un paso propio.
     */
    record(current: T, mergeable = true): void {
      const time = now();
      if (!mergeable || time - lastChangeAt > coalesceMs) {
        past.push(current);
        if (past.length > limit) past.shift();
      }
      future = [];
      lastChangeAt = mergeable ? time : -Infinity;
    },
    /** Devuelve el estado anterior, o undefined si no hay nada que deshacer. */
    undo(current: T): T | undefined {
      const previous = past.pop();
      if (previous === undefined) return undefined;
      future.push(current);
      lastChangeAt = -Infinity;
      return previous;
    },
    redo(current: T): T | undefined {
      const next = future.pop();
      if (next === undefined) return undefined;
      past.push(current);
      lastChangeAt = -Infinity;
      return next;
    },
    canUndo: () => past.length > 0,
    canRedo: () => future.length > 0,
  };
}
