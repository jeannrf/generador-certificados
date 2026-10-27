import { describe, it, expect } from 'vitest';
import { createUndoHistory } from '../src/shared/undoHistory';

function setup() {
  let time = 0;
  const history = createUndoHistory<string>({ coalesceMs: 400, now: () => time });
  let state = 'A';
  const change = (next: string, at: number) => {
    time = at;
    history.record(state);
    state = next;
  };
  return {
    history,
    change,
    get state() {
      return state;
    },
    undo() {
      state = history.undo(state) ?? state;
    },
    redo() {
      state = history.redo(state) ?? state;
    },
  };
}

describe('Historial deshacer/rehacer', () => {
  it('deshace y rehace cambios separados en el tiempo', () => {
    const h = setup();
    h.change('B', 1000);
    h.change('C', 2000);
    h.undo();
    expect(h.state).toBe('B');
    h.undo();
    expect(h.state).toBe('A');
    h.undo(); // no hay más: no cambia
    expect(h.state).toBe('A');
    h.redo();
    h.redo();
    expect(h.state).toBe('C');
  });

  it('agrupa cambios seguidos (un arrastre) en un solo paso', () => {
    const h = setup();
    h.change('x1', 1000);
    h.change('x2', 1100);
    h.change('x3', 1200);
    h.undo();
    expect(h.state).toBe('A');
  });

  it('las acciones puntuales (agregar, borrar) nunca se agrupan aunque sean seguidas', () => {
    let time = 1000;
    const history = createUndoHistory<string>({ coalesceMs: 400, now: () => time });
    history.record('sin campo', false); // agregar
    time = 1100;
    history.record('con campo', false); // borrar enseguida
    expect(history.undo('borrado')).toBe('con campo');
    expect(history.undo('con campo')).toBe('sin campo');
  });

  it('un cambio nuevo después de deshacer descarta lo que se podía rehacer', () => {
    const h = setup();
    h.change('B', 1000);
    h.undo();
    h.change('Z', 3000);
    expect(h.history.canRedo()).toBe(false);
    h.undo();
    expect(h.state).toBe('A');
  });

  it('respeta el límite de pasos guardados', () => {
    let time = 0;
    const history = createUndoHistory<number>({ limit: 3, coalesceMs: 0, now: () => (time += 10) });
    for (let i = 0; i < 10; i++) history.record(i);
    let undone = 0;
    let state: number | undefined = 10;
    while ((state = history.undo(state!)) !== undefined) undone++;
    expect(undone).toBe(3);
  });
});
